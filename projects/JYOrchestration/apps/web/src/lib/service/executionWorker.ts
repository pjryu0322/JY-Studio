/**
 * 실행 큐 워커: PENDING → RUNNING → DONE/FAILED.
 * retry 정책:
 * - retryCount: 누적 실패 횟수
 * - maxAttempts: 총 시도 횟수 상한(초기 실행 포함)
 * - canRetry 조건: (retryCount + 1) < maxAttempts
 */
import { randomUUID } from "node:crypto";
import type { ExecutionJob, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  runGitApplyCoreFromBody,
  type RunGitApplyCoreBody,
  type RunGitApplyCoreEventContext,
  type RunGitApplyCoreResult,
} from "@/lib/git-apply/runApplyCore";
import { logExecutionEvent } from "@/lib/service/executionEventService";
import { appendGitApplyAuditTrail } from "@/lib/service/taskHistoryService";

export type GitApplyExecutionPayload = RunGitApplyCoreBody & {
  actorUserId: string;
};

type StructuredJobResult = {
  ok: boolean;
  code: string;
  message: string;
  data?: unknown;
};

export type ExecutionWorkerOptions = {
  pollIntervalMs?: number;
  maxConcurrency?: number;
};

const DEFAULT_POLL_MS = 2000;
const DEFAULT_MAX_CONCURRENCY = 2;
const HEARTBEAT_INTERVAL_MS = 5000;

type WorkerRuntimeState = {
  started: boolean;
  instanceId: string;
  pollIntervalMs: number;
  maxConcurrency: number;
  timer: NodeJS.Timeout | null;
  activeJobs: Set<string>;
  processing: boolean;
};

const globalWorkerState = globalThis as typeof globalThis & {
  __jyExecutionWorkerState?: WorkerRuntimeState;
};

function getWorkerState(): WorkerRuntimeState {
  if (!globalWorkerState.__jyExecutionWorkerState) {
    globalWorkerState.__jyExecutionWorkerState = {
      started: false,
      instanceId: `worker-${randomUUID()}`,
      pollIntervalMs: DEFAULT_POLL_MS,
      maxConcurrency: DEFAULT_MAX_CONCURRENCY,
      timer: null,
      activeJobs: new Set<string>(),
      processing: false,
    };
  }
  return globalWorkerState.__jyExecutionWorkerState;
}

function logWorker(event: string, detail: Record<string, unknown>) {
  console.info("[execution-worker]", event, detail);
}

function extractGitChangeRequestId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const v = (payload as { gitChangeRequestId?: unknown }).gitChangeRequestId;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function extractMode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const v = (payload as { mode?: unknown }).mode;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function extractErrorCode(result: RunGitApplyCoreResult | StructuredJobResult): string | null {
  if ("code" in result && typeof result.code === "string") {
    return result.code;
  }
  return null;
}

async function logEventSafe(input: Parameters<typeof logExecutionEvent>[0]): Promise<void> {
  try {
    await logExecutionEvent(input);
  } catch (e) {
    console.error("[execution-worker] event log failed", e);
  }
}

function getAttemptNumber(job: Pick<ExecutionJob, "retryCount">): number {
  return job.retryCount + 1;
}

function canRetry(job: Pick<ExecutionJob, "retryCount" | "maxAttempts">): boolean {
  const failedCountAfterCurrentAttempt = job.retryCount + 1;
  return failedCountAfterCurrentAttempt < job.maxAttempts;
}

function isRetryWaiting(
  job: Pick<ExecutionJob, "status" | "availableAt">,
  now = new Date()
): boolean {
  return job.status === "PENDING" && !!job.availableAt && job.availableAt > now;
}

function serializeApplyResult(r: RunGitApplyCoreResult): Prisma.InputJsonValue {
  if (r.ok) {
    return {
      ok: true,
      data: {
        id: r.data.id,
        branchName: r.data.branchName,
        applyStatus: r.data.applyStatus,
        applyLog: r.data.applyLog,
        applyStartedAt: r.data.applyStartedAt?.toISOString() ?? null,
        applyFinishedAt: r.data.applyFinishedAt?.toISOString() ?? null,
        lastRetryAt: r.data.lastRetryAt?.toISOString() ?? null,
        retryCount: r.data.retryCount,
        lastError: r.data.lastError,
        mode: r.data.mode,
      },
      message: r.message,
      githubPr: r.githubPr,
    };
  }
  return {
    ok: false,
    code: r.code,
    message: r.message,
    httpStatus: r.httpStatus,
  };
}

function computeBackoffSeconds(nextAttemptNumber: number): number {
  if (nextAttemptNumber <= 1) return 0;
  if (nextAttemptNumber === 2) return 10;
  if (nextAttemptNumber === 3) return 30;
  return 60;
}

async function runGitApplyJob(job: ExecutionJob): Promise<RunGitApplyCoreResult> {
  const payload = job.payload;
  const p = payload as GitApplyExecutionPayload;
  const body: RunGitApplyCoreBody = {
    gitChangeRequestId: p.gitChangeRequestId,
    mode: p.mode,
    options: p.options,
    retry: p.retry === true,
  };

  const gitChangeRequestId = String(p.gitChangeRequestId ?? "").trim();
  const gcrBefore = await prisma.gitChangeRequest.findUnique({
    where: { id: gitChangeRequestId },
    select: {
      projectId: true,
      taskId: true,
      retryCount: true,
      lastError: true,
    },
  });

  const retryCountBeforeApply = gcrBefore?.retryCount ?? 0;
  const lastErrorBeforeApply = gcrBefore?.lastError ?? null;
  const isRetry = body.retry === true;
  const modeStr = String(body.mode ?? "mock").trim() || "mock";

  const eventCtx: RunGitApplyCoreEventContext = {
    executionJobId: job.id,
    projectId: job.projectId,
    taskId: gcrBefore?.taskId ?? null,
    gitChangeRequestId,
    attemptNumber: getAttemptNumber(job),
  };

  const result = await runGitApplyCoreFromBody(body, eventCtx);

  const afterRow = await prisma.gitChangeRequest.findUnique({
    where: { id: gitChangeRequestId },
    select: {
      applyStartedAt: true,
      applyStatus: true,
      branchName: true,
      applyLog: true,
      retryCount: true,
      lastError: true,
    },
  });

  if (afterRow && gcrBefore && p.actorUserId) {
    await appendGitApplyAuditTrail({
      actorUserId: p.actorUserId,
      projectId: gcrBefore.projectId,
      taskId: gcrBefore.taskId,
      mode: result.ok ? String(result.data.mode) : modeStr,
      isRetry,
      retryCountBeforeApply,
      lastErrorBeforeApply,
      afterRow,
      applyOk: result.ok,
      errorCode: result.ok ? undefined : result.code,
    });
  }
  return result;
}

async function claimNextExecutableJob(workerId: string): Promise<ExecutionJob | null> {
  const now = new Date();
  const next = await prisma.executionJob.findFirst({
    where: {
      status: "PENDING",
      OR: [{ availableAt: null }, { availableAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!next) {
    return null;
  }

  const claimed = await prisma.executionJob.updateMany({
    where: {
      id: next.id,
      status: "PENDING",
      OR: [{ availableAt: null }, { availableAt: { lte: now } }],
    },
    data: {
      status: "RUNNING",
      startedAt: now,
      finishedAt: null,
      claimedBy: workerId,
      heartbeatAt: now,
      error: null,
    },
  });
  if (claimed.count !== 1) {
    return null;
  }
  const job = await prisma.executionJob.findUnique({ where: { id: next.id } });
  if (!job) {
    return null;
  }
  logWorker("claimed", {
    jobId: job.id,
    projectId: job.projectId,
    type: job.type,
    claimedBy: workerId,
    retryCount: job.retryCount,
    attempt: getAttemptNumber(job),
  });
  return job;
}

async function executeJob(job: ExecutionJob): Promise<RunGitApplyCoreResult | StructuredJobResult> {
  switch (job.type) {
    case "git-apply":
      return runGitApplyJob(job);
    case "pipeline":
    case "cursor":
      return {
        ok: false,
        code: "JOB_TYPE_NOT_IMPLEMENTED",
        message: `Execution job type "${job.type}" is reserved for future worker handlers`,
      };
    default:
      return {
        ok: false,
        code: "JOB_TYPE_UNKNOWN",
        message: `Unknown execution job type "${job.type}"`,
      };
  }
}

async function markJobDone(jobId: string, result: RunGitApplyCoreResult | StructuredJobResult) {
  const before = await prisma.executionJob.findUnique({
    where: { id: jobId },
    select: { id: true, projectId: true, type: true, retryCount: true },
  });
  const serialized =
    "httpStatus" in result
      ? serializeApplyResult(result)
      : (result as Prisma.InputJsonValue);
  await prisma.executionJob.update({
    where: { id: jobId },
    data: {
      status: "DONE",
      finishedAt: new Date(),
      result: serialized,
      error: null,
      lastError: null,
      heartbeatAt: new Date(),
    },
  });
  if (before) {
    await logEventSafe({
      projectId: before.projectId,
      executionJobId: before.id,
      stage: "COMPLETE",
      status: "SUCCESS",
      message: "Execution job completed successfully.",
      detailJson: {
        attemptNumber: getAttemptNumber(before),
        retryCount: before.retryCount,
      } as Prisma.InputJsonValue,
    });
    logWorker("completed", {
      jobId: before.id,
      projectId: before.projectId,
      type: before.type,
      retryCount: before.retryCount,
      attempt: getAttemptNumber(before),
    });
  }
}

async function markJobRetryOrFailed(
  job: ExecutionJob,
  result: RunGitApplyCoreResult | StructuredJobResult
) {
  const message = result.message;
  const failedCountAfterCurrentAttempt = job.retryCount + 1;
  const shouldRetry = canRetry(job);
  const now = new Date();
  const serialized =
    "httpStatus" in result
      ? serializeApplyResult(result)
      : (result as Prisma.InputJsonValue);

  if (shouldRetry) {
    const retryStartedAt = new Date();
    await logEventSafe({
      projectId: job.projectId,
      executionJobId: job.id,
      stage: "RETRY",
      status: "STARTED",
      message: "Retry scheduling started.",
      detailJson: {
        attemptNumber: failedCountAfterCurrentAttempt + 1,
        retryCount: failedCountAfterCurrentAttempt,
        mode: extractMode(job.payload),
      } as Prisma.InputJsonValue,
    });
    const nextAttemptNumber = failedCountAfterCurrentAttempt + 1;
    const waitSeconds = computeBackoffSeconds(nextAttemptNumber);
    const availableAt = new Date(now.getTime() + waitSeconds * 1000);
    await prisma.executionJob.update({
      where: { id: job.id },
      data: {
        status: "PENDING",
        retryCount: failedCountAfterCurrentAttempt,
        lastError: message,
        result: serialized,
        error: null,
        claimedBy: null,
        heartbeatAt: now,
        availableAt,
        finishedAt: null,
      },
    });
    await logEventSafe({
      projectId: job.projectId,
      executionJobId: job.id,
      stage: "RETRY",
      status: "SUCCESS",
      message: `Retry scheduled for attempt ${nextAttemptNumber}.`,
      detailJson: {
        attemptNumber: nextAttemptNumber,
        retryCount: failedCountAfterCurrentAttempt,
        mode: extractMode(job.payload),
        errorCode: extractErrorCode(result),
        rawError: message,
        step: "RETRY",
      } as Prisma.InputJsonValue,
      startedAt: retryStartedAt,
    });
    logWorker("retry-scheduled", {
      jobId: job.id,
      projectId: job.projectId,
      type: job.type,
      retryCount: failedCountAfterCurrentAttempt,
      attempt: nextAttemptNumber,
      maxAttempts: job.maxAttempts,
      availableAt: availableAt.toISOString(),
      message,
    });
    return;
  }

  await prisma.executionJob.update({
    where: { id: job.id },
    data: {
      status: "FAILED",
      retryCount: failedCountAfterCurrentAttempt,
      finishedAt: now,
      result: serialized,
      error: `Execution failed after ${failedCountAfterCurrentAttempt} attempts`,
      lastError: message,
      claimedBy: null,
      heartbeatAt: now,
    },
  });
  await logEventSafe({
    projectId: job.projectId,
    executionJobId: job.id,
    stage: "COMPLETE",
    status: "FAILED",
    message: "Execution job failed permanently.",
    detailJson: {
      attemptNumber: failedCountAfterCurrentAttempt,
      retryCount: failedCountAfterCurrentAttempt,
      mode: extractMode(job.payload),
      errorCode: extractErrorCode(result),
      rawError: message,
      step: "COMPLETE",
    } as Prisma.InputJsonValue,
    startedAt: now,
  });
  logWorker("failed-final", {
    jobId: job.id,
    projectId: job.projectId,
    type: job.type,
    retryCount: failedCountAfterCurrentAttempt,
    attempt: failedCountAfterCurrentAttempt,
    maxAttempts: job.maxAttempts,
    message,
  });
}

/**
 * 특정 job 처리 (manual trigger 용). 내부적으로 claim/execute/retry 정책을 동일 적용한다.
 */
export async function processExecutionJobById(jobId: string): Promise<void> {
  const now = new Date();
  const claimed = await prisma.executionJob.updateMany({
    where: {
      id: jobId,
      status: "PENDING",
      OR: [{ availableAt: null }, { availableAt: { lte: now } }],
    },
    data: {
      status: "RUNNING",
      startedAt: now,
      finishedAt: null,
      claimedBy: "manual",
      heartbeatAt: now,
      error: null,
    },
  });
  if (claimed.count !== 1) return;

  const job = await prisma.executionJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  await logEventSafe({
    projectId: job.projectId,
    executionJobId: job.id,
    stage: "COMPLETE",
    status: "STARTED",
    message: "Execution job started.",
    detailJson: {
      attemptNumber: getAttemptNumber(job),
      retryCount: job.retryCount,
      mode: extractMode(job.payload),
      gitChangeRequestId: extractGitChangeRequestId(job.payload),
    } as Prisma.InputJsonValue,
  });
  logWorker("started", {
    jobId: job.id,
    projectId: job.projectId,
    type: job.type,
    retryCount: job.retryCount,
    attempt: getAttemptNumber(job),
  });
  try {
    const result = await executeJob(job);
    if (result.ok) {
      await markJobDone(job.id, result);
    } else {
      await markJobRetryOrFailed(job, result);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("processExecutionJobById:", e);
    await markJobRetryOrFailed(job, {
      ok: false,
      code: "WORKER_RUNTIME_ERROR",
      message: msg,
    });
  }
}

export async function processExecutionQueue(maxJobs = 10, workerId = "manual-batch"): Promise<number> {
  let processed = 0;
  for (let i = 0; i < maxJobs; i++) {
    const next = await claimNextExecutableJob(workerId);
    if (!next) {
      break;
    }
    if (isRetryWaiting(next)) {
      continue;
    }
    await logEventSafe({
      projectId: next.projectId,
      executionJobId: next.id,
      stage: "COMPLETE",
      status: "STARTED",
      message: "Execution job started.",
      detailJson: {
        attemptNumber: getAttemptNumber(next),
        retryCount: next.retryCount,
        mode: extractMode(next.payload),
        gitChangeRequestId: extractGitChangeRequestId(next.payload),
      } as Prisma.InputJsonValue,
    });
    logWorker("started", {
      jobId: next.id,
      projectId: next.projectId,
      type: next.type,
      retryCount: next.retryCount,
      attempt: getAttemptNumber(next),
    });
    try {
      const result = await executeJob(next);
      if (result.ok) {
        await markJobDone(next.id, result);
      } else {
        await markJobRetryOrFailed(next, result);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await markJobRetryOrFailed(next, {
        ok: false,
        code: "WORKER_RUNTIME_ERROR",
        message: msg,
      });
    } finally {
      processed++;
    }
  }
  return processed;
}

async function processLoopTick(): Promise<void> {
  const state = getWorkerState();
  if (state.processing) return;
  state.processing = true;
  try {
    const availableSlots = Math.max(0, state.maxConcurrency - state.activeJobs.size);
    if (availableSlots === 0) {
      return;
    }
    for (let i = 0; i < availableSlots; i++) {
      const job = await claimNextExecutableJob(state.instanceId);
      if (!job) break;
      if (isRetryWaiting(job)) {
        continue;
      }
      state.activeJobs.add(job.id);
      void logEventSafe({
        projectId: job.projectId,
        executionJobId: job.id,
        stage: "COMPLETE",
        status: "STARTED",
        message: "Execution job started.",
        detailJson: {
          attemptNumber: getAttemptNumber(job),
          retryCount: job.retryCount,
          mode: extractMode(job.payload),
          gitChangeRequestId: extractGitChangeRequestId(job.payload),
        } as Prisma.InputJsonValue,
      });
      logWorker("started", {
        jobId: job.id,
        projectId: job.projectId,
        type: job.type,
        retryCount: job.retryCount,
        attempt: getAttemptNumber(job),
      });
      void (async () => {
        const heartbeatTimer = setInterval(async () => {
          try {
            await prisma.executionJob.updateMany({
              where: { id: job.id, status: "RUNNING" },
              data: { heartbeatAt: new Date() },
            });
          } catch (e) {
            console.error("[execution-worker] heartbeat update failed", e);
          }
        }, HEARTBEAT_INTERVAL_MS);
        try {
          const result = await executeJob(job);
          if (result.ok) {
            await markJobDone(job.id, result);
          } else {
            await markJobRetryOrFailed(job, result);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await markJobRetryOrFailed(job, {
            ok: false,
            code: "WORKER_RUNTIME_ERROR",
            message: msg,
          });
        } finally {
          clearInterval(heartbeatTimer);
          state.activeJobs.delete(job.id);
        }
      })();
    }
  } finally {
    state.processing = false;
  }
}

export function startExecutionWorker(options?: ExecutionWorkerOptions): {
  started: boolean;
  instanceId: string;
  maxConcurrency: number;
  pollIntervalMs: number;
} {
  const state = getWorkerState();
  if (state.started) {
    return {
      started: false,
      instanceId: state.instanceId,
      maxConcurrency: state.maxConcurrency,
      pollIntervalMs: state.pollIntervalMs,
    };
  }

  state.pollIntervalMs = Math.max(500, options?.pollIntervalMs ?? DEFAULT_POLL_MS);
  state.maxConcurrency = Math.max(1, options?.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY);
  state.started = true;
  state.timer = setInterval(() => {
    void processLoopTick();
  }, state.pollIntervalMs);
  void processLoopTick();
  logWorker("started", {
    jobId: "worker-runtime",
    projectId: "all",
    type: "worker",
    retryCount: 0,
    attempt: 0,
    instanceId: state.instanceId,
    pollIntervalMs: state.pollIntervalMs,
    maxConcurrency: state.maxConcurrency,
  });
  return {
    started: true,
    instanceId: state.instanceId,
    maxConcurrency: state.maxConcurrency,
    pollIntervalMs: state.pollIntervalMs,
  };
}
