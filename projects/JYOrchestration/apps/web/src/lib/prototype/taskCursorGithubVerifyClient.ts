import type { QuickRunGithubAdvanceDispatch } from "@/lib/prototype/implementationQuickRunGithubAdvanceService";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import {
  type TaskCursorGithubVerifyApiResponse,
  type TaskCursorGithubVerifyRequestBody,
} from "@/lib/prototype/taskCursorGithubVerifyTypes";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

const VERIFY_GITHUB_PATH = "/api/prototype/task-cursor/verify-github";

export function buildTaskCursorGithubVerifyRequestBody(input: {
  readonly projectId: string;
  readonly execution: TaskCursorExecutionV1;
  readonly state: RequirementsStateJson;
  readonly codeTaskId?: string;
  readonly manualGithubRecheck?: boolean;
}): TaskCursorGithubVerifyRequestBody {
  const { state } = input;
  return {
    projectId: input.projectId.trim(),
    execution: input.execution,
    ...(input.codeTaskId?.trim() ? { codeTaskId: input.codeTaskId.trim() } : {}),
    ...(input.manualGithubRecheck === true ? { manualGithubRecheck: true } : {}),
    implementationTaskExecutionStateV1: state.implementationTaskExecutionStateV1,
    workItems: state.cursorWorkItemsV1 ?? [],
    codeTaskExecutionRunsV1: state.codeTaskExecutionRunsV1,
    implementationQuickRunV1: state.implementationQuickRunV1,
    implementationCodeTaskPlanV1: state.implementationCodeTaskPlanV1,
    implementationTaskListV1: state.implementationTaskListV1,
    implementationAutoQualityGateV1: state.implementationAutoQualityGateV1,
    implementationAutoQualityGateHistoryV1: state.implementationAutoQualityGateHistoryV1,
    implementationQualityGateResultsV1: state.implementationQualityGateResultsV1,
    promptTimeline: state.promptTimeline,
  };
}

export async function postTaskCursorGithubVerify(
  body: TaskCursorGithubVerifyRequestBody,
): Promise<TaskCursorGithubVerifyApiResponse> {
  const res = await credentialsIncludeFetch(VERIFY_GITHUB_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as TaskCursorGithubVerifyApiResponse;
}

export type ApplyTaskCursorGithubVerifyResultInput = Readonly<{
  readonly json: TaskCursorGithubVerifyApiResponse;
  readonly enrichPatch: (
    patch: PrototypeExecutionOrchestrationPersistInput,
  ) => PrototypeExecutionOrchestrationPersistInput;
  readonly applyOrchestrationPatch: (patch: PrototypeExecutionOrchestrationPersistInput) => void;
  readonly onNextQuickRunDispatch?: (dispatch: QuickRunGithubAdvanceDispatch) => void;
  readonly shouldApplyNextDispatch?: (dispatch: QuickRunGithubAdvanceDispatch) => boolean;
}>;

export function applyTaskCursorGithubVerifyApiResult(
  input: ApplyTaskCursorGithubVerifyResultInput,
): boolean {
  const { json } = input;
  if (json.orchestrationPatch) {
    input.applyOrchestrationPatch(input.enrichPatch(json.orchestrationPatch));
  }
  if (!json.success) {
    return false;
  }
  const next = json.nextQuickRunDispatch;
  if (
    next &&
    !json.continuationDispatchedOnServer &&
    (input.shouldApplyNextDispatch?.(next) ?? true)
  ) {
    input.onNextQuickRunDispatch?.(next);
  }
  return true;
}

export function resolveTaskCursorGithubVerifyUserNotice(
  json: TaskCursorGithubVerifyApiResponse,
): string {
  if (json.success) {
    return json.message ?? "GitHub commit 확인 완료";
  }
  const detail = json.verify?.detailReason;
  const reason = json.verify?.reason;
  if (
    detail === "branch_not_found" ||
    detail === "commit_not_found" ||
    reason === "commit_not_created"
  ) {
    return "GitHub push 반영 대기 중 · 1분 간격으로 다시 확인합니다";
  }
  return json.message ?? "GitHub commit 확인 실패";
}
