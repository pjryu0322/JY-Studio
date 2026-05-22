/**
 * Runtime orchestration support exports (read-only).
 */

export type { ExecutionWorkerStructuredResult } from "@/lib/runtime/executionWorkerStructuredResult";

export { handleCursorExecutionJob, runCursorJobSynchronously } from "@/lib/runtime/cursorExecutionJobHandler";
export {
  loadCursorExecutionInvokeContext,
  invokeCursorExecution,
  isCursorInvokeContext,
} from "@/lib/runtime/cursorExecutionJobInvoke";
export {
  persistCursorExecutionSuccess,
  persistCursorExecutionFailure,
  isCursorRunSuccessWithResult,
} from "@/lib/runtime/cursorExecutionJobPersist";

export { handlePipelineExecutionJob } from "@/lib/runtime/pipelineExecutionJobHandler";
export {
  resolvePipelinePhaseContext,
  isPipelinePhaseContext,
} from "@/lib/runtime/pipelineExecutionJobContext";
export {
  runReviewerPhase,
  runSecurityPhase,
  runScmPhase,
  runMergePhase,
} from "@/lib/runtime/pipelineExecutionPhases";

export { appendRuntimeEvent } from "@/lib/runtime/runtimeEventService";
export { RUNTIME_EVENT_TYPES } from "@/lib/runtime/runtimeEventTypes";
export {
  shouldRetryExecution,
  shouldBlockRepeatedFailure,
  retryReasonForWorker,
} from "@/lib/runtime/executionRetryPolicy";
export {
  buildRuntimeDashboardSnapshot,
  listRuntimeTimelineForExecRun,
} from "@/lib/runtime/runtimeObservability";
export {
  runNormalTaskViaRuntimeWorkers,
  isNormalTaskWorkerDispatchEnabled,
  isLegacyInlineCursorPathForced,
  shouldUseRuntimeWorkerPathForTask,
  type WorkerDispatchStep,
} from "@/lib/runtime/normalTaskWorkerDispatch";
export { PIPELINE_RESULT_CODE, pipelineMessageForCode } from "@/lib/runtime/pipelineResultCodes";
export {
  getRuntimeTimelineFromStore,
  clearRuntimeTimelineStore,
} from "@/lib/runtime/runtimeTimelineStore";
export {
  isRuntimeSelfHealingAutoCursorEnabled,
} from "@/lib/runtime/runtimeSelfHealingBridge";
export { confirmCursorGitReflection } from "@/lib/runtime/cursorExecutionReflection";
export { runPipelineJobSynchronously } from "@/lib/runtime/pipelineExecutionJobSync";
export { maybeEnqueueSelfHealingFromReviewFailure } from "@/lib/runtime/runtimeSelfHealingBridge";

export {
  parseCursorExecutionJobPayload,
  type CursorExecutionJobPayload,
} from "@/lib/runtime/cursorExecutionJobTypes";
export {
  parsePipelineExecutionJobPayload,
  type PipelineExecutionJobPayload,
} from "@/lib/runtime/pipelineExecutionJobTypes";
