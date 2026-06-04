import { PROMPT_PREFLIGHT_FAILED_PHASE } from "@/lib/prototype/codeTaskPromptPreflightFailure";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";

export type TaskCursorExecuteJsonResponse = Readonly<{
  readonly success?: boolean;
  readonly message?: string;
  readonly pollRequired?: boolean;
  readonly phase?: string;
  readonly failureReason?: string;
  readonly status?: string;
  readonly errors?: readonly string[];
  readonly orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
}>;

export function orchestrationPatchHasPromptPreflightFailure(
  patch: PrototypeExecutionOrchestrationPersistInput | null | undefined,
): boolean {
  const execution = parseTaskCursorExecutionV1(patch?.taskCursorExecutionV1);
  return execution?.failureReason === "prompt_preflight_failed";
}

export function isTaskCursorExecutePromptPreflightFailure(
  json: TaskCursorExecuteJsonResponse | null | undefined,
): boolean {
  if (!json) return false;
  if (json.phase === PROMPT_PREFLIGHT_FAILED_PHASE) return true;
  if (json.failureReason === "prompt_preflight_failed") return true;
  return orchestrationPatchHasPromptPreflightFailure(json.orchestrationPatch);
}
