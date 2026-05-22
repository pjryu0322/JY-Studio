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
import { triggerSelfHealingLite } from "@/lib/service/selfHealingService";
import { triggerAutoHealingExecution } from "@/lib/service/autoHealingExecutionService";
import { AUTO_HEALING_AUTO_RUN_ENABLED } from "@/lib/execution/autoHealingExecutionPolicy";
import { handleCursorExecutionJob } from "@/lib/runtime/cursorExecutionJobHandler";
import { handlePipelineExecutionJob } from "@/lib/runtime/pipelineExecutionJobHandler";

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
  /** 바쁠 때(클레임 발생 또는 실행 중 job 있음) 다음 폴링까지 대기(ms) */
  pollIntervalMs?: number;
  /** 유휴(pending 없음·실행 중 job 없음)일 때 다음 폴링까지 대기(ms) */
  pollIdleMs?: number;
  maxConcurrency?: number;
};

const DEFAULT_POLL_MS = 2000;
const DEFAULT_IDLE_POLL_MS = 4500;
const DEFAULT_MAX_CONCURRENCY = 2;
const HEARTBEAT_INTERVAL_MS = 5000;

type WorkerRuntimeState = {
  started: boolean;
  instanceId: string;
  pollActiveMs: number;
  pollIdleMs: number;
  maxConcurrency: number;
  timer: NodeJS.Timeout | null;
  activeJobs: Set<string>;
  processing: boolean;
};

const globalWorkerState = globalThis as typeof globalThis & {
  __jyExecutionWorkerState?: WorkerRuntimeState;
  __jyFailureClassifierSelfTestRan?: boolean;
};

function getWorkerState(): WorkerRuntimeState {
  if (!globalWorkerState.__jyExecutionWorkerState) {
    globalWorkerState.__jyExecutionWorkerState = {
      started: false,
      instanceId: `worker-${randomUUID()}`,
      pollActiveMs: DEFAULT_POLL_MS,
      pollIdleMs: DEFAULT_IDLE_POLL_MS,
      maxConcurrency: DEFAULT_MAX_CONCURRENCY,
      timer: null,
      activeJobs: new Set<string>(),
      processing: false,
    };
  }
  return globalWorkerState.__jyExecutionWorkerState;
}

async function maybeRunFailureClassifierSelfTest(): Promise<void> {
  if (
    globalWorkerState.__jyFailureClassifierSelfTestRan ||
    process.env.NODE_ENV === "production" ||
    process.env.EXECUTION_FAILURE_CLASSIFIER_TEST !== "1"
  ) {
    return;
  }

  globalWorkerState.__jyFailureClassifierSelfTestRan = true;

  try {
    const projectId = await prisma.project
      .findFirst({
        select: { id: true },
      })
      .then((r) => r?.id);

    if (!projectId) {
      logWorker("failure-classifier-selftest-skipped", { reason: "no project" });
      return;
    }

    const executionJob = await prisma.executionJob.create({
      data: {
        projectId,
        type: "git-apply",
        status: "PENDING",
        payload: {} as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    const jobId = executionJob.id;

    const samples: Array<{
      name: string;
      message: string;
      detailJson: Prisma.InputJsonValue;
    }> = [
      {
        name: "cursor_failure",
        message: "cursor_execution_failed",
        detailJson: {
          step: "EXECUTE",
          attempt: 1,
          error: "cursor_execution_failed",
          rawError: "cursor_execution_failed",
          errorCode: "CURSOR_EXECUTION_FAILED",
        } as Prisma.InputJsonValue,
      },
      {
        name: "git_apply_failure",
        message: "git apply failed",
        detailJson: {
          step: "EXECUTE",
          attempt: 1,
          error: "git apply failed",
          rawError: "git apply failed",
        } as Prisma.InputJsonValue,
      },
      {
        name: "pr_create_failure",
        message: "pull request failed",
        detailJson: {
          step: "PR",
          attempt: 1,
          error: "pull request failed",
          rawError: "pull request failed",
        } as Prisma.InputJsonValue,
      },
    ];

    for (const s of samples) {
      await logEventSafe({
        projectId,
        executionJobId: jobId,
        stage: "EXECUTE",
        status: "FAILED",
        message: s.message,
        detailJson: s.detailJson,
      });
    }

    const events = await prisma.executionEventLog.findMany({
      where: { executionJobId: jobId },
      orderBy: { createdAt: "asc" },
      select: { message: true, stage: true, failureType: true },
    });

    logWorker("failure-classifier-selftest-result", {
      jobId,
      events: events.map((e) => ({
        stage: e.stage,
        message: e.message,
        failureType: e.failureType,
      })),
    });
    await prisma.executionJob.delete({ where: { id: jobId } });
  } catch (e) {
    console.error("[failure-classifier-selftest] failed:", e);
  }
}

function logWorker(event: string, detail: Record<string, unknown>) {
  console.info("[execution-worker]", event, detail);
}

function extractGitChangeRequestId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const v = (payload as { gitChangeRequestId?: unknown }).gitChangeRequestId;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function extractTaskIdFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const v = (payload as { taskId?: unknown }).taskId;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

async function resolveSourceTaskIdFromJob(job: ExecutionJob): Promise<string | null> {
  const gitChangeRequestId = extractGitChangeRequestId(job.payload);
  if (gitChangeRequestId) {
    const gcr = await prisma.gitChangeRequest.findUnique({
      where: { id: gitChangeRequestId },
      select: { taskId: true },
    });
    if (gcr?.taskId) return gcr.taskId;
  }

  const payloadTaskId = extractTaskIdFromPayload(job.payload);
  return payloadTaskId;
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

async function runJobWithExecutionEvents(
  job: ExecutionJob
): Promise<RunGitApplyCoreResult | StructuredJobResult> {
  const execStartedAt = new Date();
  await logEventSafe({
    projectId: job.projectId,
    executionJobId: job.id,
    stage: "EXECUTE",
    status: "STARTED",
    detailJson: {
      attempt: getAttemptNumber(job),
      type: job.type,
    } as Prisma.InputJsonValue,
  });
  try {
    const result = await executeJob(job);
    if (result && "ok" in result && result.ok) {
      await logEventSafe({
        projectId: job.projectId,
        executionJobId: job.id,
        stage: "EXECUTE",
        status: "SUCCESS",
        startedAt: execStartedAt,
        detailJson: {
          attempt: getAttemptNumber(job),
          type: job.type,
        } as Prisma.InputJsonValue,
      });
    } else {
      const message = result?.message ?? "Execution failed";
      await logEventSafe({
        projectId: job.projectId,
        executionJobId: job.id,
        stage: "EXECUTE",
        status: "FAILED",
        message,
        startedAt: execStartedAt,
        detailJson: {
          step: "EXECUTE",
          attempt: getAttemptNumber(job),
          type: job.type,
          error: message,
          rawError: message,
        } as Prisma.InputJsonValue,
      });
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logEventSafe({
      projectId: job.projectId,
      executionJobId: job.id,
      stage: "EXECUTE",
      status: "FAILED",
      message,
      startedAt: execStartedAt,
      detailJson: {
        attempt: getAttemptNumber(job),
        type: job.type,
        step: "EXECUTE",
        error: message,
        rawError: message,
      } as Prisma.InputJsonValue,
    });
    throw error;
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
      type: { not: "runtime-timeline" },
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
      type: { not: "runtime-timeline" },
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
    case "cursor":
      return handleCursorExecutionJob(job);
    case "pipeline":
      return handlePipelineExecutionJob(job);
    case "runtime-timeline":
      return { ok: true, code: "TIMELINE_HOLDER", message: "runtime timeline holder job" };
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
      message: "Execution completed",
      detailJson: {
        attempt: getAttemptNumber(before),
        type: before.type,
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
    await logEventSafe({
      projectId: job.projectId,
      executionJobId: job.id,
      stage: "RETRY",
      status: "STARTED",
      message: "Retry scheduled",
      detailJson: {
        attempt: failedCountAfterCurrentAttempt + 1,
        type: job.type,
        error: message,
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
    message: "Execution failed",
    detailJson: {
      step: "COMPLETE",
      attempt: failedCountAfterCurrentAttempt,
      type: job.type,
      error: message,
      rawError: message,
      errorCode: extractErrorCode(result),
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

  // FINAL FAILED 이후 Self-Healing Lite (자동 복구 시도 X, 작업 등록만 수행)
  try {
    const lastEvent = await prisma.executionEventLog.findFirst({
      where: { executionJobId: job.id, status: "FAILED" },
      orderBy: { createdAt: "desc" },
      select: { failureType: true, detailJson: true },
    });
    if (!lastEvent) return;

    const failureType = lastEvent.failureType ? String(lastEvent.failureType) : null;
    const sourceTaskId = await resolveSourceTaskIdFromJob(job);

    // AUTO_HEALING Task에서 발생한 실패는 다시 Self-Healing을 분기하지 않는다.
    if (sourceTaskId) {
      const sourceTask = await prisma.task.findUnique({
        where: { id: sourceTaskId },
        select: { taskKind: true },
      });
      if (sourceTask?.taskKind === "AUTO_HEALING") {
        logWorker("self-healing-skipped-auto-task", {
          jobId: job.id,
          sourceTaskId,
        });
        return;
      }
    }

    const res = await triggerSelfHealingLite({
      jobId: job.id,
      projectId: job.projectId,
      failureType,
      detailJson: lastEvent.detailJson,
      sourceTaskId,
    });

    let autoRunRes:
      | {
          triggered: boolean;
          executedTaskIds: string[];
          skippedTaskIds: Array<{ taskId: string; reason: string }>;
        }
      | null = null;
    if (res.created && AUTO_HEALING_AUTO_RUN_ENABLED) {
      try {
        autoRunRes = await triggerAutoHealingExecution({
          projectId: job.projectId,
          sourceExecutionJobId: job.id,
          createdTaskIds: res.createdTasks.map((t) => t.taskId),
        });
      } catch (e) {
        console.error("[execution-worker] autoHealingExecution failed:", e);
        autoRunRes = { triggered: false, executedTaskIds: [], skippedTaskIds: [] };
      }
    } else {
      autoRunRes = { triggered: false, executedTaskIds: [], skippedTaskIds: [] };
    }

    const failureTypeKey = failureType ?? "UNKNOWN";
    const strategiesText = res.strategies.join(", ");
    const createdTasksText =
      res.createdTasks.length > 0
        ? res.createdTasks.map((t) => `- ${t.strategy}: ${t.taskId}`).join("\n")
        : "";

    const message = res.created
      ? autoRunRes?.triggered
        ? `Task 생성 및 자동 실행 연결됨 (${res.createdTasks.length} tasks)\nfailureType: ${failureTypeKey}\nstrategies: ${strategiesText}\ncreatedTasks:\n${createdTasksText}\nAuto Run:\ntriggered: true\nexecuted: ${autoRunRes.executedTaskIds.length}\nskipped: ${autoRunRes.skippedTaskIds.length}`
        : `Task 생성됨 (${res.createdTasks.length} tasks)\nfailureType: ${failureTypeKey}\nstrategies: ${strategiesText}\ncreatedTasks:\n${createdTasksText}`
      : `생성 실패 (${res.reason ?? "UNKNOWN"})\nfailureType: ${failureTypeKey}\nstrategies: ${strategiesText}`;

    await logEventSafe({
      projectId: job.projectId,
      executionJobId: job.id,
      stage: "SELF_HEALING",
      status: res.created ? "SUCCESS" : "FAILED",
      message,
      detailJson: {
        failureType: failureTypeKey,
        strategies: res.strategies,
        createdTasks: res.createdTasks,
        sourceTaskId,
        created: res.created,
        reason: res.reason ?? null,
        autoRunTriggered: Boolean(autoRunRes?.triggered),
        autoRunExecutedTaskIds: autoRunRes?.executedTaskIds ?? [],
        autoRunSkippedTaskIds: (autoRunRes?.skippedTaskIds ?? []).map((x) => x.taskId),
      } as Prisma.InputJsonValue,
    });

    logWorker("self-healing-triggered", {
      jobId: job.id,
      created: res.created,
      createdTasks: res.createdTasks,
      reason: res.reason,
      failureType,
      strategies: res.strategies,
      autoRunTriggered: Boolean(autoRunRes?.triggered),
    });
  } catch (e) {
    console.error("[execution-worker] self-healing-lite failed:", e);
    logWorker("self-healing-lite-error", {
      jobId: job.id,
      projectId: job.projectId,
      message: e instanceof Error ? e.message : String(e),
    });
  }
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
  logWorker("started", {
    jobId: job.id,
    projectId: job.projectId,
    type: job.type,
    retryCount: job.retryCount,
    attempt: getAttemptNumber(job),
  });
  try {
    const result = await runJobWithExecutionEvents(job);
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
    logWorker("started", {
      jobId: next.id,
      projectId: next.projectId,
      type: next.type,
      retryCount: next.retryCount,
      attempt: getAttemptNumber(next),
    });
    try {
      const result = await runJobWithExecutionEvents(next);
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

/** 이번 틱에서 비동기 실행을 시작한 job 수 (유휴 폴링 완화 판단용) */
async function processLoopTick(): Promise<number> {
  const state = getWorkerState();
  if (state.processing) {
    return 0;
  }
  state.processing = true;
  let started = 0;
  try {
    const availableSlots = Math.max(0, state.maxConcurrency - state.activeJobs.size);
    if (availableSlots === 0) {
      return 0;
    }
    for (let i = 0; i < availableSlots; i++) {
      const job = await claimNextExecutableJob(state.instanceId);
      if (!job) break;
      if (isRetryWaiting(job)) {
        continue;
      }
      state.activeJobs.add(job.id);
      started += 1;
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
          const result = await runJobWithExecutionEvents(job);
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
    return started;
  } finally {
    state.processing = false;
  }
}

export function startExecutionWorker(options?: ExecutionWorkerOptions): {
  started: boolean;
  instanceId: string;
  maxConcurrency: number;
  pollIntervalMs: number;
  pollIdleMs: number;
} {
  const state = getWorkerState();
  if (state.started) {
    return {
      started: false,
      instanceId: state.instanceId,
      maxConcurrency: state.maxConcurrency,
      pollIntervalMs: state.pollActiveMs,
      pollIdleMs: state.pollIdleMs,
    };
  }

  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[execution-worker] DATABASE_URL 없음 — 워커 시작 생략");
    return {
      started: false,
      instanceId: state.instanceId,
      maxConcurrency: state.maxConcurrency,
      pollIntervalMs: state.pollActiveMs,
      pollIdleMs: state.pollIdleMs,
    };
  }

  void maybeRunFailureClassifierSelfTest();

  state.pollActiveMs = Math.max(500, options?.pollIntervalMs ?? DEFAULT_POLL_MS);
  state.pollIdleMs = Math.max(
    2000,
    Math.min(120_000, options?.pollIdleMs ?? DEFAULT_IDLE_POLL_MS)
  );
  state.maxConcurrency = Math.max(1, options?.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY);
  state.started = true;

  async function runWorkerLoop(): Promise<void> {
    if (!state.started) {
      return;
    }
    let delay = state.pollIdleMs;
    try {
      if (state.processing) {
        delay = state.pollActiveMs;
      } else {
        const startedThisTick = await processLoopTick();
        const busy = state.activeJobs.size > 0 || startedThisTick > 0;
        delay = busy ? state.pollActiveMs : state.pollIdleMs;
      }
    } catch (e) {
      console.error("[execution-worker] processLoopTick failed:", e);
      delay = state.pollIdleMs;
    }
    if (state.timer != null) {
      clearTimeout(state.timer);
    }
    state.timer = setTimeout(() => {
      void runWorkerLoop();
    }, delay);
  }

  void runWorkerLoop();

  logWorker("started", {
    jobId: "worker-runtime",
    projectId: "all",
    type: "worker",
    retryCount: 0,
    attempt: 0,
    instanceId: state.instanceId,
    pollIntervalMs: state.pollActiveMs,
    pollIdleMs: state.pollIdleMs,
    maxConcurrency: state.maxConcurrency,
  });
  return {
    started: true,
    instanceId: state.instanceId,
    maxConcurrency: state.maxConcurrency,
    pollIntervalMs: state.pollActiveMs,
    pollIdleMs: state.pollIdleMs,
  };
}
