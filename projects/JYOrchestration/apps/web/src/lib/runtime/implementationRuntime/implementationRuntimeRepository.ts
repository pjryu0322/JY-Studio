import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertRuntimeTransition,
  type RuntimeState,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeStateMachine";
import type {
  ImplementationRuntimeBundleView,
  ImplementationRuntimeEventType,
  ImplementationRuntimeJobView,
  ImplementationRuntimeRunView,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

const ACTIVE_JOB_STATUSES = ["running"] as const;

function toIso(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString();
}

function mapRun(row: {
  id: string;
  projectId: string;
  jobId: string;
  codeTaskId: string;
  runtimeState: string;
  cursorAgentId: string | null;
  branchName: string | null;
  commitSha: string | null;
  pullRequestUrl: string | null;
  failureReason: string | null;
  lastHeartbeatAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
}): ImplementationRuntimeRunView {
  return {
    id: row.id,
    projectId: row.projectId,
    jobId: row.jobId,
    codeTaskId: row.codeTaskId,
    runtimeState: row.runtimeState as RuntimeState,
    cursorAgentId: row.cursorAgentId,
    branchName: row.branchName,
    commitSha: row.commitSha,
    pullRequestUrl: row.pullRequestUrl,
    failureReason: row.failureReason,
    lastHeartbeatAt: toIso(row.lastHeartbeatAt),
    startedAt: toIso(row.startedAt),
    completedAt: toIso(row.completedAt),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapJob(row: {
  id: string;
  projectId: string;
  status: string;
  currentCodeTaskId: string | null;
  failureReason: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
}): ImplementationRuntimeJobView {
  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status as ImplementationRuntimeJobView["status"],
    currentCodeTaskId: row.currentCodeTaskId,
    failureReason: row.failureReason,
    startedAt: toIso(row.startedAt),
    completedAt: toIso(row.completedAt),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function recordImplementationRuntimeEvent(input: {
  readonly projectId: string;
  readonly eventType: ImplementationRuntimeEventType;
  readonly jobId?: string | null;
  readonly runId?: string | null;
  readonly payload?: Record<string, unknown> | null;
}): Promise<void> {
  await prisma.implementationRuntimeEvent.create({
    data: {
      projectId: input.projectId.trim(),
      jobId: input.jobId?.trim() || null,
      runId: input.runId?.trim() || null,
      eventType: input.eventType,
      payloadJson: input.payload ? (input.payload as Prisma.InputJsonValue) : undefined,
    },
  });
}

export async function findActiveImplementationRuntimeJob(
  projectId: string,
): Promise<(ImplementationRuntimeJobView & { runs: ImplementationRuntimeRunView[] }) | null> {
  const pid = projectId.trim();
  const job = await prisma.implementationExecutionJob.findFirst({
    where: {
      projectId: pid,
      status: { in: [...ACTIVE_JOB_STATUSES] },
      completedAt: null,
    },
    orderBy: { createdAt: "desc" },
    include: {
      runs: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!job) return null;
  return {
    ...mapJob(job),
    runs: job.runs.map(mapRun),
  };
}

export async function getImplementationRuntimeBundle(
  projectId: string,
): Promise<ImplementationRuntimeBundleView> {
  const active = await findActiveImplementationRuntimeJob(projectId);
  if (!active) {
    return { job: null, runs: [], currentRun: null };
  }
  const currentRun =
    active.runs.find((r) => r.codeTaskId === active.currentCodeTaskId) ??
    active.runs[active.runs.length - 1] ??
    null;
  return {
    job: active,
    runs: active.runs,
    currentRun,
  };
}

export async function createImplementationRuntimeJob(input: {
  readonly projectId: string;
  readonly selectedCodeTaskIds: readonly string[];
  readonly now?: Date;
}): Promise<ImplementationRuntimeBundleView> {
  const now = input.now ?? new Date();
  const pid = input.projectId.trim();
  const firstCodeTaskId = input.selectedCodeTaskIds[0]?.trim() ?? null;

  const job = await prisma.implementationExecutionJob.create({
    data: {
      projectId: pid,
      status: "running",
      currentCodeTaskId: firstCodeTaskId,
      startedAt: now,
    },
  });

  await recordImplementationRuntimeEvent({
    projectId: pid,
    jobId: job.id,
    eventType: "job_created",
    payload: { selectedCodeTaskIds: input.selectedCodeTaskIds },
  });

  return { job: mapJob(job), runs: [], currentRun: null };
}

export async function createImplementationCodeTaskRun(input: {
  readonly projectId: string;
  readonly jobId: string;
  readonly codeTaskId: string;
  readonly now?: Date;
}): Promise<ImplementationRuntimeRunView> {
  const now = input.now ?? new Date();
  const run = await prisma.implementationCodeTaskRun.create({
    data: {
      projectId: input.projectId.trim(),
      jobId: input.jobId.trim(),
      codeTaskId: input.codeTaskId.trim(),
      runtimeState: "queued",
      startedAt: now,
      lastHeartbeatAt: now,
    },
  });

  await prisma.implementationExecutionJob.update({
    where: { id: input.jobId.trim() },
    data: { currentCodeTaskId: input.codeTaskId.trim(), updatedAt: now },
  });

  await recordImplementationRuntimeEvent({
    projectId: input.projectId.trim(),
    jobId: input.jobId.trim(),
    runId: run.id,
    eventType: "run_created",
    payload: { codeTaskId: input.codeTaskId, runtimeState: "queued" },
  });

  return mapRun(run);
}

export async function transitionImplementationCodeTaskRun(input: {
  readonly runId: string;
  readonly toState: RuntimeState;
  readonly patch?: Partial<{
    readonly cursorAgentId: string | null;
    readonly branchName: string | null;
    readonly commitSha: string | null;
    readonly pullRequestUrl: string | null;
    readonly failureReason: string | null;
  }>;
  readonly now?: Date;
}): Promise<ImplementationRuntimeRunView> {
  const now = input.now ?? new Date();
  const existing = await prisma.implementationCodeTaskRun.findUnique({
    where: { id: input.runId.trim() },
  });
  if (!existing) {
    throw new Error(`ImplementationCodeTaskRun not found: ${input.runId}`);
  }
  const fromState = existing.runtimeState as RuntimeState;
  assertRuntimeTransition(fromState, input.toState);

  const terminal = input.toState === "completed" || input.toState === "failed" || input.toState === "stale";
  const run = await prisma.implementationCodeTaskRun.update({
    where: { id: existing.id },
    data: {
      runtimeState: input.toState,
      lastHeartbeatAt: now,
      updatedAt: now,
      ...(input.patch?.cursorAgentId !== undefined ? { cursorAgentId: input.patch.cursorAgentId } : {}),
      ...(input.patch?.branchName !== undefined ? { branchName: input.patch.branchName } : {}),
      ...(input.patch?.commitSha !== undefined ? { commitSha: input.patch.commitSha } : {}),
      ...(input.patch?.pullRequestUrl !== undefined ? { pullRequestUrl: input.patch.pullRequestUrl } : {}),
      ...(input.patch?.failureReason !== undefined ? { failureReason: input.patch.failureReason } : {}),
      ...(terminal ? { completedAt: now } : {}),
    },
  });

  await recordImplementationRuntimeEvent({
    projectId: run.projectId,
    jobId: run.jobId,
    runId: run.id,
    eventType: "run_transition",
    payload: { from: fromState, to: input.toState },
  });

  return mapRun(run);
}

export async function touchImplementationCodeTaskRunHeartbeat(input: {
  readonly runId: string;
  readonly cursorAgentId?: string | null;
  readonly now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  await prisma.implementationCodeTaskRun.update({
    where: { id: input.runId.trim() },
    data: {
      lastHeartbeatAt: now,
      updatedAt: now,
      ...(input.cursorAgentId !== undefined ? { cursorAgentId: input.cursorAgentId } : {}),
    },
  });
}

export async function pauseImplementationRuntimeJob(input: {
  readonly jobId: string;
  readonly failureReason?: string | null;
  readonly now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  const job = await prisma.implementationExecutionJob.update({
    where: { id: input.jobId.trim() },
    data: {
      status: "paused",
      failureReason: input.failureReason ?? null,
      updatedAt: now,
    },
  });
  await recordImplementationRuntimeEvent({
    projectId: job.projectId,
    jobId: job.id,
    eventType: "job_paused",
    payload: { failureReason: input.failureReason ?? null },
  });
}

export async function completeImplementationRuntimeJob(input: {
  readonly jobId: string;
  readonly status?: "completed" | "completed_with_issues" | "failed";
  readonly now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  const job = await prisma.implementationExecutionJob.update({
    where: { id: input.jobId.trim() },
    data: {
      status: input.status ?? "completed",
      completedAt: now,
      updatedAt: now,
    },
  });
  await recordImplementationRuntimeEvent({
    projectId: job.projectId,
    jobId: job.id,
    eventType: "job_completed",
    payload: { status: input.status ?? "completed" },
  });
}

export async function listImplementationRuntimeEvents(input: {
  readonly projectId: string;
  readonly limit?: number;
}): Promise<
  readonly {
    readonly id: string;
    readonly eventType: string;
    readonly jobId: string | null;
    readonly runId: string | null;
    readonly createdAt: string;
  }[]
> {
  const rows = await prisma.implementationRuntimeEvent.findMany({
    where: { projectId: input.projectId.trim() },
    orderBy: { createdAt: "desc" },
    take: input.limit ?? 50,
  });
  return rows.map((r) => ({
    id: r.id,
    eventType: r.eventType,
    jobId: r.jobId,
    runId: r.runId,
    createdAt: r.createdAt.toISOString(),
  }));
}
