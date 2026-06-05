import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TASK_CURSOR_JOB_DEFAULT_POLL_DELAY_MS } from "@/lib/prototype/taskCursorExecutionJobRepository";
import type { RuntimeState } from "@/lib/runtime/implementationRuntime/implementationRuntimeStateMachine";

export const RUNTIME_POLL_SCHEDULE_STATES = [
  "dispatching",
  "cursor_running",
  "github_verifying",
] as const satisfies readonly RuntimeState[];

export const IMPLEMENTATION_RUNTIME_POLL_LOCK_MS = 60_000 as const;

export type ImplementationRuntimePollRunRow = Prisma.ImplementationCodeTaskRunGetPayload<{
  include: { taskCursorJob: true };
}>;

function isPollScheduleState(state: string): boolean {
  return (RUNTIME_POLL_SCHEDULE_STATES as readonly string[]).includes(state);
}

export async function releaseStaleImplementationRuntimePollLocks(now: Date = new Date()): Promise<number> {
  const result = await prisma.implementationCodeTaskRun.updateMany({
    where: {
      completedAt: null,
      pollLockedBy: { not: null },
      pollLockExpiresAt: { lt: now },
    },
    data: {
      pollLockedBy: null,
      pollLockExpiresAt: null,
    },
  });
  return result.count;
}

export async function claimDueImplementationRuntimePollRuns(input: {
  readonly workerId: string;
  readonly limit?: number;
  readonly projectId?: string | null;
  readonly now?: Date;
}): Promise<readonly ImplementationRuntimePollRunRow[]> {
  const workerId = input.workerId.trim();
  const now = input.now ?? new Date();
  const limit = Math.max(1, input.limit ?? 1);
  const projectId = input.projectId?.trim();
  const claimed: ImplementationRuntimePollRunRow[] = [];

  for (let i = 0; i < limit; i += 1) {
    const candidate = await prisma.implementationCodeTaskRun.findFirst({
      where: {
        completedAt: null,
        runtimeState: { in: [...RUNTIME_POLL_SCHEDULE_STATES] },
        ...(projectId ? { projectId } : {}),
        AND: [
          { OR: [{ nextPollAt: null }, { nextPollAt: { lte: now } }] },
          { OR: [{ pollLockedBy: null }, { pollLockExpiresAt: { lt: now } }] },
          {
            OR: [
              { taskCursorJobId: { not: null } },
              {
                taskCursorJobId: null,
                branchName: { not: null },
                cursorAgentId: { not: null },
              },
            ],
          },
        ],
      },
      orderBy: [{ nextPollAt: "asc" }, { updatedAt: "asc" }],
      include: { taskCursorJob: true },
    });
    if (!candidate) break;

    const lockExpiresAt = new Date(now.getTime() + IMPLEMENTATION_RUNTIME_POLL_LOCK_MS);
    const updated = await prisma.implementationCodeTaskRun.updateMany({
      where: {
        id: candidate.id,
        completedAt: null,
        OR: [{ pollLockedBy: null }, { pollLockExpiresAt: { lt: now } }],
      },
      data: {
        pollLockedBy: workerId,
        pollLockExpiresAt: lockExpiresAt,
      },
    });
    if (updated.count === 0) continue;

    const locked = await prisma.implementationCodeTaskRun.findUnique({
      where: { id: candidate.id },
      include: { taskCursorJob: true },
    });
    if (locked) claimed.push(locked);
  }

  return claimed;
}

export async function clearImplementationRuntimePollLock(runId: string): Promise<void> {
  await prisma.implementationCodeTaskRun.updateMany({
    where: { id: runId.trim() },
    data: { pollLockedBy: null, pollLockExpiresAt: null },
  });
}

export async function scheduleImplementationRuntimePoll(input: {
  readonly runId: string;
  readonly nextPollAt?: Date | null;
  readonly now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  const nextPollAt =
    input.nextPollAt === undefined
      ? new Date(now.getTime() + TASK_CURSOR_JOB_DEFAULT_POLL_DELAY_MS)
      : input.nextPollAt;
  await prisma.implementationCodeTaskRun.update({
    where: { id: input.runId.trim() },
    data: {
      nextPollAt,
      updatedAt: now,
    },
  });
}

export async function syncRunPollScheduleFromJob(input: {
  readonly runId: string;
  readonly pollCount: number;
  readonly lastPollAt: Date;
  readonly nextPollAt?: Date | null;
  readonly terminal: boolean;
}): Promise<void> {
  await prisma.implementationCodeTaskRun.update({
    where: { id: input.runId.trim() },
    data: {
      pollCount: input.pollCount,
      lastPollAt: input.lastPollAt,
      nextPollAt: input.terminal ? null : input.nextPollAt ?? null,
      pollLockedBy: null,
      pollLockExpiresAt: null,
    },
  });
}

export async function linkTaskCursorJobToImplementationRun(input: {
  readonly projectId: string;
  readonly taskCursorJobId: string;
  readonly codeTaskId?: string | null;
  readonly now?: Date;
}): Promise<string | null> {
  const pid = input.projectId.trim();
  const jobId = input.taskCursorJobId.trim();
  const now = input.now ?? new Date();
  const codeTaskId = input.codeTaskId?.trim();

  const activeJob = await prisma.implementationExecutionJob.findFirst({
    where: { projectId: pid, status: "running", completedAt: null },
    orderBy: { createdAt: "desc" },
    include: { runs: { orderBy: { createdAt: "asc" } } },
  });
  if (!activeJob) return null;

  const run =
    (codeTaskId ? activeJob.runs.find((r) => r.codeTaskId === codeTaskId) : null) ??
    activeJob.runs.find((r) => r.codeTaskId === activeJob.currentCodeTaskId) ??
    activeJob.runs[activeJob.runs.length - 1] ??
    null;
  if (!run) return null;

  await prisma.$transaction(async (tx) => {
    const priorHolder = await tx.implementationCodeTaskRun.findFirst({
      where: {
        taskCursorJobId: jobId,
        id: { not: run.id },
      },
    });
    if (priorHolder) {
      await tx.implementationCodeTaskRun.update({
        where: { id: priorHolder.id },
        data: {
          taskCursorJobId: null,
          updatedAt: now,
        },
      });
    }

    await tx.implementationCodeTaskRun.update({
      where: { id: run.id },
      data: {
        taskCursorJobId: jobId,
        nextPollAt: now,
        pollCount: run.pollCount ?? 0,
        pollLockedBy: null,
        pollLockExpiresAt: null,
        updatedAt: now,
      },
    });
  });

  return run.id;
}

export async function findImplementationRunByTaskCursorJobId(
  taskCursorJobId: string,
): Promise<ImplementationRuntimePollRunRow | null> {
  return prisma.implementationCodeTaskRun.findFirst({
    where: { taskCursorJobId: taskCursorJobId.trim() },
    include: { taskCursorJob: true },
  });
}
