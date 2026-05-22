/**
 * Cursor execution job worker handler (ExecutionRun-centric).
 */

import type { ExecutionJob } from "@prisma/client";
import {
  type CursorExecutionJobResult,
  parseCursorExecutionJobPayload,
} from "@/lib/runtime/cursorExecutionJobTypes";
import type { ExecutionWorkerStructuredResult } from "@/lib/runtime/executionWorkerStructuredResult";
import {
  isCursorRunSuccessWithResult,
  persistCursorExecutionFailure,
  persistCursorExecutionSuccess,
} from "@/lib/runtime/cursorExecutionJobPersist";
import {
  invokeCursorExecution,
  isCursorInvokeContext,
  loadCursorExecutionInvokeContext,
} from "@/lib/runtime/cursorExecutionJobInvoke";
import { maybeChainCursorJobToPipeline } from "@/lib/runtime/cursorToPipelineChain";
import { appendRuntimeEvent } from "@/lib/runtime/runtimeEventService";

export { runCursorJobSynchronously } from "@/lib/runtime/cursorExecutionJobSync";

export async function handleCursorExecutionJob(job: ExecutionJob): Promise<ExecutionWorkerStructuredResult> {
  const payload = parseCursorExecutionJobPayload(job.payload);
  if (!payload) {
    return {
      ok: false,
      code: "INVALID_CURSOR_PAYLOAD",
      message: "Cursor job payload must include execRunId, taskId, projectId, actorUserId",
    };
  }

  if (payload.projectId !== job.projectId) {
    return { ok: false, code: "PROJECT_MISMATCH", message: "Job projectId does not match payload" };
  }

  await appendRuntimeEvent({
    eventType: "CURSOR_STARTED",
    projectId: payload.projectId,
    taskId: payload.taskId,
    execRunId: payload.execRunId,
    actorUserId: payload.actorUserId,
    workerName: "cursor",
    executionJobId: job.id,
    runtimeState: "running",
  });

  const loaded = await loadCursorExecutionInvokeContext(payload, job.id);
  if (!isCursorInvokeContext(loaded)) {
    return loaded;
  }

  let cursorOutcome: Awaited<ReturnType<typeof invokeCursorExecution>>;
  try {
    cursorOutcome = await invokeCursorExecution(loaded);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await persistCursorExecutionFailure(payload.execRunId, msg);
    await appendRuntimeEvent({
      eventType: "CURSOR_FAILED",
      severity: "error",
      projectId: payload.projectId,
      taskId: payload.taskId,
      execRunId: payload.execRunId,
      actorUserId: payload.actorUserId,
      workerName: "cursor",
      failurePhase: "EXECUTE",
      executionJobId: job.id,
      runtimeState: "failed",
      detail: { error: msg },
    });
    return { ok: false, code: "CURSOR_RUNTIME_ERROR", message: msg };
  }

  if (!cursorOutcome.ok) {
    const msg = cursorOutcome.error ?? "cursor failed";
    await persistCursorExecutionFailure(payload.execRunId, msg);
    await appendRuntimeEvent({
      eventType: "CURSOR_FAILED",
      severity: "error",
      projectId: payload.projectId,
      taskId: payload.taskId,
      execRunId: payload.execRunId,
      actorUserId: payload.actorUserId,
      workerName: "cursor",
      failurePhase: "EXECUTE",
      executionJobId: job.id,
      runtimeState: "failed",
      detail: { error: msg },
    });
    const result: CursorExecutionJobResult = {
      ok: false,
      code: "CURSOR_FAILED",
      message: msg,
      cursorOutcome,
    };
    return { ok: false, code: result.code, message: result.message, data: result };
  }

  await persistCursorExecutionSuccess(payload.execRunId, cursorOutcome, loaded.branchName);

  await appendRuntimeEvent({
    eventType: "CURSOR_COMPLETED",
    projectId: payload.projectId,
    taskId: payload.taskId,
    execRunId: payload.execRunId,
    actorUserId: payload.actorUserId,
    workerName: "cursor",
    executionJobId: job.id,
    runtimeState: "awaiting_git_reflection",
    detail: {
      runId: isCursorRunSuccessWithResult(cursorOutcome) ? cursorOutcome.result.runId : null,
    },
  });

  const chain = await maybeChainCursorJobToPipeline({
    projectId: payload.projectId,
    taskId: payload.taskId,
    execRunId: payload.execRunId,
    actorUserId: payload.actorUserId,
    cursorOutcome,
    cursorJobId: job.id,
    source:
      payload.chainSource ??
      (payload.selfHealingFromExecRunId ? "self-healing" : "background"),
    skipPipelineChain: payload.syncDispatch === true,
    selfHealingFromExecRunId: payload.selfHealingFromExecRunId ?? null,
  });

  const result: CursorExecutionJobResult = {
    ok: true,
    code: "CURSOR_COMPLETED",
    message: chain.chained
      ? "Cursor execution completed; pipeline job enqueued"
      : "Cursor execution completed",
    cursorOutcome,
    pipelineChain: chain,
  };
  return { ok: true, code: result.code, message: result.message, data: result };
}
