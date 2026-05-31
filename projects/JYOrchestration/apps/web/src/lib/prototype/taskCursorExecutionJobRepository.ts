import type { Prisma } from "@prisma/client";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import {
  isActiveTaskCursorJobStatus,
  isTerminalTaskCursorJobStatus,
  mapTaskCursorExecutionStatusToJobStatus,
  type TaskCursorJobSummary,
  toTaskCursorJobSummary,
} from "@/lib/prototype/taskCursorExecutionJobTypes";
import { parseTaskCursorExecutionV1, type TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { prisma } from "@/lib/prisma";

const ACTIVE_JOB_STATUS_FILTER = [
  "queued",
  "cursor_requested",
  "cursor_running",
  "github_verifying",
] as const;

export const TASK_CURSOR_JOB_LOCK_MS = 60_000;
export const TASK_CURSOR_JOB_DEFAULT_POLL_DELAY_MS = 10_000;

export type TaskCursorExecutionJobRow = Awaited<
  ReturnType<typeof prisma.taskCursorExecutionJob.findFirst>
> & {};

export function buildTaskCursorJobCreateInput(input: {
  readonly projectId: string;
  readonly execution: TaskCursorExecutionV1;
  readonly workItems: readonly CursorWorkItem[];
  readonly history?: readonly TaskCursorExecutionV1[] | null;
  readonly now?: Date;
}): Prisma.TaskCursorExecutionJobCreateInput {
  const now = input.now ?? new Date();
  const status = mapTaskCursorExecutionStatusToJobStatus(input.execution.status);
  return {
    project: { connect: { id: input.projectId.trim() } },
    taskId: input.execution.taskId,
    cursorRunId: input.execution.cursorRunId ?? null,
    status,
    targetRepository: input.execution.targetRepository,
    baseBranch: input.execution.baseBranch,
    workBranch: input.execution.workBranch,
    workItemIdsJson: [...input.execution.workItemIds] as Prisma.InputJsonValue,
    executionJson: input.execution as unknown as Prisma.InputJsonValue,
    historyJson: input.history?.length
      ? (input.history as unknown as Prisma.InputJsonValue)
      : undefined,
    nextPollAt: now,
    pollCount: 0,
    maxPollCount: 270,
  };
}

export async function findActiveTaskCursorJob(input: {
  readonly projectId: string;
  readonly taskId?: string | null;
  readonly cursorRunId?: string | null;
}): Promise<TaskCursorExecutionJobRow | null> {
  const projectId = input.projectId.trim();
  const taskId = input.taskId?.trim();
  const cursorRunId = input.cursorRunId?.trim();
  return prisma.taskCursorExecutionJob.findFirst({
    where: {
      projectId,
      ...(taskId ? { taskId } : {}),
      ...(cursorRunId ? { cursorRunId } : {}),
      completedAt: null,
      status: { in: [...ACTIVE_JOB_STATUS_FILTER] },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function upsertTaskCursorExecutionJobFromLaunch(input: {
  readonly projectId: string;
  readonly execution: TaskCursorExecutionV1;
  readonly workItems: readonly CursorWorkItem[];
  readonly history?: readonly TaskCursorExecutionV1[] | null;
  readonly now?: Date;
}): Promise<TaskCursorExecutionJobRow> {
  const existing = await findActiveTaskCursorJob({
    projectId: input.projectId,
    taskId: input.execution.taskId,
    cursorRunId: input.execution.cursorRunId ?? null,
  });
  if (existing) return existing;

  const sameTaskActive = await findActiveTaskCursorJob({
    projectId: input.projectId,
    taskId: input.execution.taskId,
  });
  if (sameTaskActive) return sameTaskActive;

  return prisma.taskCursorExecutionJob.create({
    data: buildTaskCursorJobCreateInput(input),
  });
}

export async function createQueuedTaskCursorExecutionJob(input: {
  readonly projectId: string;
  readonly execution: TaskCursorExecutionV1;
  readonly workItems: readonly CursorWorkItem[];
  readonly history?: readonly TaskCursorExecutionV1[] | null;
  readonly now?: Date;
}): Promise<TaskCursorExecutionJobRow> {
  const now = input.now ?? new Date();
  return prisma.taskCursorExecutionJob.create({
    data: {
      ...buildTaskCursorJobCreateInput({ ...input, now }),
      status: "queued",
      cursorRunId: null,
      nextPollAt: now,
    },
  });
}

export async function releaseStaleTaskCursorJobLocks(now: Date = new Date()): Promise<number> {
  const result = await prisma.taskCursorExecutionJob.updateMany({
    where: {
      completedAt: null,
      lockedBy: { not: null },
      lockExpiresAt: { lt: now },
    },
    data: {
      lockedBy: null,
      lockedAt: null,
      lockExpiresAt: null,
    },
  });
  return result.count;
}

export async function claimDueTaskCursorJobs(input: {
  readonly workerId: string;
  readonly limit?: number;
  readonly now?: Date;
}): Promise<TaskCursorExecutionJobRow[]> {
  const workerId = input.workerId.trim();
  const now = input.now ?? new Date();
  const limit = Math.max(1, input.limit ?? 1);
  const claimed: TaskCursorExecutionJobRow[] = [];

  for (let i = 0; i < limit; i += 1) {
    const candidate = await prisma.taskCursorExecutionJob.findFirst({
      where: {
        completedAt: null,
        status: { in: [...ACTIVE_JOB_STATUS_FILTER] },
        AND: [
          { OR: [{ nextPollAt: null }, { nextPollAt: { lte: now } }] },
          { OR: [{ lockedBy: null }, { lockExpiresAt: { lt: now } }] },
        ],
      },
      orderBy: [{ nextPollAt: "asc" }, { createdAt: "asc" }],
    });
    if (!candidate) break;

    const lockExpiresAt = new Date(now.getTime() + TASK_CURSOR_JOB_LOCK_MS);
    const updated = await prisma.taskCursorExecutionJob.updateMany({
      where: {
        id: candidate.id,
        completedAt: null,
        OR: [{ lockedBy: null }, { lockExpiresAt: { lt: now } }],
      },
      data: {
        lockedBy: workerId,
        lockedAt: now,
        lockExpiresAt,
      },
    });
    if (updated.count === 0) continue;

    const locked = await prisma.taskCursorExecutionJob.findUnique({ where: { id: candidate.id } });
    if (locked) claimed.push(locked);
  }

  return claimed;
}

export async function clearTaskCursorJobLock(jobId: string): Promise<void> {
  await prisma.taskCursorExecutionJob.updateMany({
    where: { id: jobId },
    data: { lockedBy: null, lockedAt: null, lockExpiresAt: null },
  });
}

export async function updateTaskCursorJobAfterPoll(input: {
  readonly jobId: string;
  readonly execution: TaskCursorExecutionV1;
  readonly status: string;
  readonly pollCount: number;
  readonly lastPollAt: Date;
  readonly nextPollAt?: Date | null;
  readonly failureReason?: string | null;
  readonly errorMessage?: string | null;
  readonly terminal: boolean;
}): Promise<TaskCursorExecutionJobRow> {
  const jobStatus = mapTaskCursorExecutionStatusToJobStatus(input.status);
  return prisma.taskCursorExecutionJob.update({
    where: { id: input.jobId },
    data: {
      status: input.terminal ? jobStatus : isActiveTaskCursorJobStatus(jobStatus) ? jobStatus : input.status,
      cursorRunId: input.execution.cursorRunId ?? null,
      executionJson: input.execution as unknown as Prisma.InputJsonValue,
      failureReason: input.failureReason ?? input.execution.failureReason ?? null,
      errorMessage: input.errorMessage ?? input.execution.errorMessage ?? null,
      pollCount: input.pollCount,
      lastPollAt: input.lastPollAt,
      nextPollAt: input.terminal ? null : input.nextPollAt ?? null,
      completedAt: input.terminal ? input.lastPollAt : null,
      lockedBy: null,
      lockedAt: null,
      lockExpiresAt: null,
    },
  });
}

export async function markTaskCursorJobCancelled(input: {
  readonly jobId: string;
  readonly failureReason?: string;
  readonly errorMessage?: string;
  readonly now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  await prisma.taskCursorExecutionJob.updateMany({
    where: { id: input.jobId, completedAt: null },
    data: {
      status: "cancelled",
      failureReason: input.failureReason ?? "poll_cancelled",
      errorMessage: input.errorMessage ?? null,
      completedAt: now,
      nextPollAt: null,
      lockedBy: null,
      lockedAt: null,
      lockExpiresAt: null,
    },
  });
}

export async function markTaskCursorJobTimeout(input: {
  readonly jobId: string;
  readonly execution: TaskCursorExecutionV1;
  readonly now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  await prisma.taskCursorExecutionJob.updateMany({
    where: { id: input.jobId, completedAt: null },
    data: {
      status: "timeout",
      failureReason: "poll_timeout",
      errorMessage: "Cloud Agent 폴링 시간 초과",
      executionJson: {
        ...input.execution,
        status: "cursor_failed",
        failureReason: "poll_timeout",
        errorMessage: "Cloud Agent 폴링 시간 초과",
        updatedAt: now.toISOString(),
      } as unknown as Prisma.InputJsonValue,
      completedAt: now,
      nextPollAt: null,
      lockedBy: null,
      lockedAt: null,
      lockExpiresAt: null,
    },
  });
}

export async function listTaskCursorJobsForProject(projectId: string): Promise<TaskCursorJobSummary[]> {
  const rows = await prisma.taskCursorExecutionJob.findMany({
    where: { projectId: projectId.trim() },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return rows.map((row) => toTaskCursorJobSummary(row));
}

export async function findLatestActiveTaskCursorJobSummary(
  projectId: string,
): Promise<TaskCursorJobSummary | null> {
  const row = await findActiveTaskCursorJob({ projectId });
  if (!row) return null;
  const summary = toTaskCursorJobSummary(row);
  const execution = parseTaskCursorExecutionV1(row.executionJson);
  return { ...summary, execution };
}

export function parseTaskCursorJobExecution(job: TaskCursorExecutionJobRow): TaskCursorExecutionV1 | null {
  return parseTaskCursorExecutionV1(job.executionJson);
}

export function isJobPollTimedOut(job: TaskCursorExecutionJobRow, now: Date = new Date()): boolean {
  if (job.completedAt) return false;
  if (job.pollCount >= job.maxPollCount) return true;
  if (isTerminalTaskCursorJobStatus(job.status)) return false;
  return false;
}
