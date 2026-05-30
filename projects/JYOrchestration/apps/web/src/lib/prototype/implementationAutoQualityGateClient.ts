import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import {
  isImplementationAutoQualityGateInFlight,
  parseImplementationAutoQualityGateV1,
  shouldAutoStartImplementationQualityGate,
  shouldResumeImplementationAutoQualityGate,
} from "@/lib/prototype/implementationAutoQualityGate";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { parseTaskCursorExecutionV1, type TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";

export type ImplementationAutoQualityGateClientInput = Readonly<{
  readonly projectId: string;
  readonly taskCursorExecutionV1?: TaskCursorExecutionV1 | null;
  readonly implementationTaskListV1?: unknown;
  readonly implementationTaskExecutionStateV1?: unknown;
  readonly implementationQualityGateResultsV1?: unknown;
  readonly implementationAutoQualityGateV1?: unknown;
  readonly implementationAutoQualityGateHistoryV1?: unknown;
  readonly cursorWorkItemsV1?: readonly CursorWorkItem[];
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
}>;

export function shouldTriggerImplementationAutoQualityGateClient(
  input: ImplementationAutoQualityGateClientInput,
): boolean {
  const execution = parseTaskCursorExecutionV1(input.taskCursorExecutionV1);
  if (!execution) return false;
  const autoGate = parseImplementationAutoQualityGateV1(input.implementationAutoQualityGateV1);
  return (
    shouldAutoStartImplementationQualityGate({
      taskCursorExecution: execution,
      autoGate,
    }) ||
    shouldResumeImplementationAutoQualityGate({
      taskCursorExecution: execution,
      autoGate,
    })
  );
}

export function buildImplementationAutoQualityGateTriggerKey(
  execution: TaskCursorExecutionV1,
): string {
  return `${execution.taskId}:${String(execution.commitSha ?? "").trim()}`;
}

export async function runImplementationAutoQualityGateClient(
  input: ImplementationAutoQualityGateClientInput,
): Promise<
  Readonly<{
    readonly ok: boolean;
    readonly message?: string;
    readonly orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
    readonly status?: string;
  }>
> {
  const execution = parseTaskCursorExecutionV1(input.taskCursorExecutionV1);
  if (!execution) {
    return { ok: false, message: "Task Cursor 실행 상태가 없습니다." };
  }
  const res = await credentialsIncludeFetch("/api/prototype/implementation/auto-quality-gate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: input.projectId,
      taskId: execution.taskId,
      taskCursorExecutionV1: execution,
      implementationTaskListV1: input.implementationTaskListV1,
      implementationTaskExecutionStateV1: input.implementationTaskExecutionStateV1,
      implementationQualityGateResultsV1: input.implementationQualityGateResultsV1,
      implementationAutoQualityGateV1: input.implementationAutoQualityGateV1,
      cursorWorkItemsV1: input.cursorWorkItemsV1,
      promptTimeline: input.promptTimeline,
      mode: "review_then_security",
    }),
  });
  const json = (await res.json()) as {
    success?: boolean;
    status?: string;
    message?: string;
    orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
  };
  return {
    ok: json.success === true,
    status: json.status,
    message: json.message,
    orchestrationPatch: json.orchestrationPatch,
  };
}

export function isImplementationAutoQualityGateClientInFlight(
  autoGate: unknown,
): boolean {
  return isImplementationAutoQualityGateInFlight(parseImplementationAutoQualityGateV1(autoGate));
}
