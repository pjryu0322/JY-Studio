import {
  DATA_MODEL_DRAFT_CHIP,
  DB_INTEGRATION_REVIEW_CHIP,
  MOCK_IMPLEMENTATION_CHIP,
  type ImplementationDbStrategyV1,
} from "@/lib/prototype/implementationDbStrategy";
import {
  hasImplementationWorkPlanDraftReady,
  WORK_PLAN_DRAFT_GENERATE_CHIP,
  WORK_PLAN_SCOPE_DIRECT_INPUT_CHIP,
  type ImplementationWorkPlanDraftV1,
} from "@/lib/prototype/implementationWorkPlanDraft";
import {
  IMPLEMENTATION_ENVIRONMENT_CHECK_VIEW_CHIP,
  IMPLEMENTATION_ROLE_CHECK_VIEW_CHIP,
  IMPLEMENTATION_SCM_CHECK_VIEW_CHIP,
} from "@/lib/prototype/implementationOrchestrationSummary";
import {
  CODE_AGENT_WIP_WORK_REQUEST_CHIP,
  LEGACY_CURSOR_WIP_WORK_REQUEST_CHIP,
  REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP,
} from "@/lib/prototype/codeAgentWipExecution";
import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import {
  AI_DEVELOPER_EXECUTION_REQUEST_CHIP,
  VERIFY_TASK_CURSOR_GITHUB_CHIP,
} from "@/lib/prototype/taskCursorExecution";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import type { ImplementationQualityGateResultV1 } from "@/lib/prototype/implementationQualityGate";
import type { ImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import type { ImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";
import type { ImplementationExecutionBoardStateV1 } from "@/lib/prototype/implementationExecutionBoardState";
import type { ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import {
  mergeRequirementsStateJson,
  type RequirementsPromptTimelineEntry,
  type RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import { sanitizePromptTimelineEntries } from "@/lib/requirements/promptTimelineState";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import {
  IMPLEMENTATION_ARTIFACT_REVIEW_LABEL,
  IMPLEMENTATION_ENV_SETTINGS_LABEL,
  REVIEWER_CHECK_RUN_CHIP,
  SECURITY_CHECK_RUN_CHIP,
  AI_DEVELOPER_REMEDIATION_REQUEST_CHIP,
  IMPLEMENTATION_GENERATION_REQUEST_CHIP,
  GENERATE_IMPLEMENTATION_TASK_LIST_CHIP,
  RUN_FINAL_SCM_CHIP,
  RUN_PLATFORM_SCM_MERGE_CHIP,
  RUN_INTEGRATED_REVIEW_CHIP,
  RUN_INTEGRATED_SECURITY_CHIP,
  RUN_REFACTOR_COMMON_CHIP,
  IMPLEMENTATION_USER_CONFIRMATION_RESOLVE_CHIP,
  IMPLEMENTATION_USER_CONFIRMATION_RESOLVE_ALL_CHIP,
  IMPLEMENTATION_USER_CONFIRMATION_VIEW_CHIP,
  MOVE_TO_REVIEW_STAGE_CHIP,
  REVIEW_STAGE_ADD_FEEDBACK_CHIP,
  REVIEW_STAGE_COMPLETE_TEST_CHIP,
  REVIEW_STAGE_OPEN_PREVIEW_CHIP,
  REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION_CHIP,
  REVIEW_STAGE_START_USER_TEST_CHIP,
  REVIEW_STAGE_VIEW_FEEDBACK_CHIP,
  QUICK_DESIGN_CONFIRM_ACTION_LABEL,
  CREATE_IMPLEMENTATION_SEED_FROM_QUICK_DESIGN_DRAFT_LABEL,
  START_QUICK_DESIGN_FROM_IMPLEMENTATION_LABEL,
  IMPLEMENTATION_QUICK_RUN_CHIP,
  IMPLEMENTATION_FORCE_RELEASE_EXECUTION_CHIP,
  IMPLEMENTATION_RUNTIME_REDISPATCH_CHIP,
  IMPLEMENTATION_RUNTIME_DIAGNOSTICS_CHIP,
} from "@/lib/requirements/implementationUxLabels";
import { IMPLEMENTATION_BLOCKED_RETURN_TO_PLANNING_CHIP } from "@/lib/prototype/implementationWorkPlanDraft";
import { mapReviewStageChipToAction } from "@/lib/prototype/reviewStageMessage";

export type ImplementationStageActionId =
  | "GENERATE_IMPLEMENTATION_TASK_LIST"
  | "GENERATE_IMPLEMENTATION_WORK_PLAN"
  | "CONFIRM_IMPLEMENTATION_WORK_PLAN"
  | "EDIT_IMPLEMENTATION_SCOPE"
  | "REVIEW_DB_INTEGRATION"
  | "GENERATE_DATA_MODEL_DRAFT"
  | "CONFIRM_MOCK_IMPLEMENTATION"
  | "SHOW_ARTIFACTS"
  | "OPEN_ENV_SETTINGS"
  | "SHOW_ROLE_CHECK"
  | "SHOW_SCM_CHECK"
  | "SHOW_ENV_CHECK"
  | "REQUEST_CODE_AGENT_WIP"
  | "REQUEST_CURSOR_BRIDGE_EXECUTION"
  | "REQUEST_TASK_CURSOR_EXECUTION"
  | "VERIFY_TASK_CURSOR_GITHUB"
  | "RUN_REVIEWER_CHECK"
  | "RUN_SECURITY_CHECK"
  | "RUN_REFACTOR_COMMON"
  | "RUN_INTEGRATED_REVIEW"
  | "RUN_INTEGRATED_SECURITY"
  | "RUN_FINAL_SCM"
  | "RUN_PLATFORM_SCM_MERGE"
  | "RESOLVE_USER_CONFIRMATION"
  | "SHOW_USER_CONFIRMATION_ITEMS"
  | "MOVE_TO_REVIEW_STAGE"
  | "REVIEW_STAGE_OPEN_PREVIEW"
  | "REVIEW_STAGE_START_USER_TEST"
  | "REVIEW_STAGE_ADD_FEEDBACK"
  | "REVIEW_STAGE_VIEW_FEEDBACK"
  | "REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION"
  | "REVIEW_STAGE_COMPLETE_TEST"
  | "CONFIRM_QUICK_DESIGN_FOR_IMPLEMENTATION"
  | "CREATE_IMPLEMENTATION_SEED_FROM_QUICK_DESIGN_DRAFT"
  | "START_QUICK_DESIGN_FROM_IMPLEMENTATION"
  | "START_IMPLEMENTATION_QUICK_RUN"
  | "RELEASE_IMPLEMENTATION_EXECUTION_LOCK"
  | "REDISPATCH_IMPLEMENTATION_RUNTIME"
  | "SHOW_IMPLEMENTATION_RUNTIME_DIAGNOSTICS"
  | "RETURN_TO_PLANNING_STAGE";

export type PendingImplementationPatch = Readonly<{
  implementationWorkPlanDraftV1?: ImplementationWorkPlanDraftV1 | null;
  implementationTaskPlanV1?: ImplementationTaskPlanV1 | null;
  implementationTaskListV1?: ImplementationTaskListV1 | null;
  cursorWorkItemsV1?: readonly CursorWorkItem[] | null;
  codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
  taskCursorExecutionV1?: TaskCursorExecutionV1 | null;
  taskCursorExecutionHistoryV1?: readonly TaskCursorExecutionV1[] | null;
  implementationAutoQualityGateV1?: ImplementationAutoQualityGateV1 | null;
  implementationAutoQualityGateHistoryV1?: readonly ImplementationAutoQualityGateV1[] | null;
  implementationQualityGateResultsV1?: readonly ImplementationQualityGateResultV1[] | null;
  implementationTaskExecutionStateV1?: ImplementationTaskExecutionStateV1 | null;
  implementationExecutionBoardStateV1?: ImplementationExecutionBoardStateV1 | null;
  promptTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  implementationExecutionJobsV1?: readonly import("@/lib/prototype/implementationExecutionJob").ImplementationExecutionJobV1[] | null;
  codeTaskExecutionRunsV1?: readonly import("@/lib/prototype/codeTaskExecutionRun").CodeTaskExecutionRunV1[] | null;
  implementationRuntimeStateV1?: import("@/lib/prototype/implementationRuntimeState").ImplementationRuntimeStateV1 | null;
  implementationRuntimeUiSnapshotV1?: import("@/lib/runtime/implementationRuntime/implementationRuntimeUiSnapshot").ImplementationRuntimeUiSnapshotV1 | null;
  implementationIntegratedExecutionStateV1?: ImplementationIntegratedExecutionStateV1 | null;
  implementationPreviewScopeV1?: ImplementationPreviewScopeV1 | null;
  implementationPreviewRuntimeV1?: ImplementationPreviewRuntimeV1 | null;
}>;

export function resolveOrchestrationAwareRequirementsState(input: {
  readonly base: RequirementsStateJson;
  readonly pendingPatch?: PendingImplementationPatch | null;
}): RequirementsStateJson {
  const pending = input.pendingPatch;
  if (!pending) return input.base;
  return mergeRequirementsStateJson(input.base, {
    ...(pending.implementationWorkPlanDraftV1 !== undefined
      ? { implementationWorkPlanDraftV1: pending.implementationWorkPlanDraftV1 }
      : {}),
    ...(pending.implementationTaskPlanV1 !== undefined
      ? { implementationTaskPlanV1: pending.implementationTaskPlanV1 }
      : {}),
    ...(pending.implementationTaskListV1 !== undefined
      ? { implementationTaskListV1: pending.implementationTaskListV1 }
      : {}),
    ...(pending.cursorWorkItemsV1 !== undefined
      ? { cursorWorkItemsV1: pending.cursorWorkItemsV1 ? [...pending.cursorWorkItemsV1] : null }
      : {}),
    ...(pending.codeAgentWipExecutionV1 !== undefined
      ? { codeAgentWipExecutionV1: pending.codeAgentWipExecutionV1 }
      : {}),
    ...(pending.taskCursorExecutionV1 !== undefined
      ? { taskCursorExecutionV1: pending.taskCursorExecutionV1 }
      : {}),
    ...(pending.taskCursorExecutionHistoryV1 !== undefined
      ? { taskCursorExecutionHistoryV1: pending.taskCursorExecutionHistoryV1 }
      : {}),
    ...(pending.implementationAutoQualityGateV1 !== undefined
      ? { implementationAutoQualityGateV1: pending.implementationAutoQualityGateV1 }
      : {}),
    ...(pending.implementationAutoQualityGateHistoryV1 !== undefined
      ? { implementationAutoQualityGateHistoryV1: pending.implementationAutoQualityGateHistoryV1 }
      : {}),
    ...(pending.implementationQualityGateResultsV1 !== undefined
      ? { implementationQualityGateResultsV1: pending.implementationQualityGateResultsV1 }
      : {}),
    ...(pending.implementationTaskExecutionStateV1 !== undefined
      ? { implementationTaskExecutionStateV1: pending.implementationTaskExecutionStateV1 }
      : {}),
    ...(pending.implementationExecutionBoardStateV1 !== undefined
      ? { implementationExecutionBoardStateV1: pending.implementationExecutionBoardStateV1 }
      : {}),
    ...(pending.promptTimeline !== undefined
      ? { promptTimeline: sanitizePromptTimelineEntries(pending.promptTimeline) }
      : {}),
    ...(pending.implementationExecutionJobsV1 !== undefined
      ? {
          implementationExecutionJobsV1: pending.implementationExecutionJobsV1
            ? [...pending.implementationExecutionJobsV1]
            : null,
        }
      : {}),
    ...(pending.codeTaskExecutionRunsV1 !== undefined
      ? {
          codeTaskExecutionRunsV1: pending.codeTaskExecutionRunsV1
            ? [...pending.codeTaskExecutionRunsV1]
            : null,
        }
      : {}),
    ...(pending.implementationRuntimeUiSnapshotV1 !== undefined
      ? { implementationRuntimeUiSnapshotV1: pending.implementationRuntimeUiSnapshotV1 }
      : {}),
    ...(pending.implementationRuntimeStateV1 !== undefined &&
    pending.implementationRuntimeUiSnapshotV1 === undefined
      ? { implementationRuntimeStateV1: pending.implementationRuntimeStateV1 }
      : {}),
    ...(pending.implementationIntegratedExecutionStateV1 !== undefined
      ? { implementationIntegratedExecutionStateV1: pending.implementationIntegratedExecutionStateV1 }
      : {}),
    ...(pending.implementationPreviewScopeV1 !== undefined
      ? { implementationPreviewScopeV1: pending.implementationPreviewScopeV1 }
      : {}),
    ...(pending.implementationPreviewRuntimeV1 !== undefined
      ? { implementationPreviewRuntimeV1: pending.implementationPreviewRuntimeV1 }
      : {}),
  });
}

/** WIP [생성요청] 직전: persisted state + pending orchestration patch 병합 */
export function resolveLatestWipRequestRequirementsState(input: {
  readonly base: RequirementsStateJson;
  readonly pendingPatch?: PendingImplementationPatch | null;
}): RequirementsStateJson {
  return resolveOrchestrationAwareRequirementsState(input);
}

export type EffectiveImplementationState = Readonly<{
  implementationSeedV1: ImplementationSeedV1 | null;
  implementationTaskListV1: ImplementationTaskListV1 | null;
  implementationWorkPlanDraftV1: ImplementationWorkPlanDraftV1 | null;
  implementationTaskPlanV1: ImplementationTaskPlanV1 | null;
  implementationDbStrategyV1: ImplementationDbStrategyV1 | null;
  envOk: boolean;
  designOk: boolean;
  latestRun: PrototypeRun | null;
  hasWorkUnits: boolean;
  plannerRunning: boolean;
  plannerCreatePending: boolean;
  protoBusy: boolean;
}>;

export type ImplementationStageActionGateResult =
  | Readonly<{ readonly ok: true }>
  | Readonly<{ readonly ok: false; readonly message: string }>;

export type ImplementationWorkPlanConfirmGateResult = ImplementationStageActionGateResult;

export function shouldClearPendingImplementationPatch(input: {
  readonly prevPersistedDraftUpdatedAt?: string | null;
  readonly nextPersistedDraftUpdatedAt?: string | null;
  readonly prevPersistedTaskPlanCreatedAt?: string | null;
  readonly nextPersistedTaskPlanCreatedAt?: string | null;
  readonly prevImplementationSessionActive?: boolean;
  readonly nextImplementationSessionActive?: boolean;
}): boolean {
  const isInitial =
    input.prevPersistedDraftUpdatedAt === undefined &&
    input.prevPersistedTaskPlanCreatedAt === undefined &&
    input.prevImplementationSessionActive === undefined;
  if (isInitial) return false;
  if (input.prevImplementationSessionActive && input.nextImplementationSessionActive === false) {
    return true;
  }
  if (input.prevPersistedDraftUpdatedAt !== input.nextPersistedDraftUpdatedAt) return true;
  if (input.prevPersistedTaskPlanCreatedAt !== input.nextPersistedTaskPlanCreatedAt) return true;
  return false;
}

export function resolveEffectiveImplementationState(input: {
  readonly parsedRequirementsState: {
    readonly implementationSeedV1?: ImplementationSeedV1 | null;
    readonly implementationTaskListV1?: ImplementationTaskListV1 | null;
    readonly implementationWorkPlanDraftV1?: ImplementationWorkPlanDraftV1 | null;
    readonly implementationTaskPlanV1?: ImplementationTaskPlanV1 | null;
    readonly implementationDbStrategyV1?: ImplementationDbStrategyV1 | null;
  };
  readonly pendingPatch?: PendingImplementationPatch | null;
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly latestRun?: PrototypeRun | null;
  readonly plannerRunning?: boolean;
  readonly plannerCreatePending?: boolean;
  readonly protoBusy?: boolean;
}): EffectiveImplementationState {
  const latestRun = input.latestRun ?? null;
  return {
    implementationSeedV1: input.parsedRequirementsState.implementationSeedV1 ?? null,
    implementationTaskListV1: input.parsedRequirementsState.implementationTaskListV1 ?? null,
    implementationWorkPlanDraftV1:
      input.pendingPatch?.implementationWorkPlanDraftV1 ??
      input.parsedRequirementsState.implementationWorkPlanDraftV1 ??
      null,
    implementationTaskPlanV1:
      input.pendingPatch?.implementationTaskPlanV1 ??
      input.parsedRequirementsState.implementationTaskPlanV1 ??
      null,
    implementationDbStrategyV1: input.parsedRequirementsState.implementationDbStrategyV1 ?? null,
    envOk: input.envOk,
    designOk: input.designOk,
    latestRun,
    hasWorkUnits: (latestRun?.workUnits?.length ?? 0) > 0,
    plannerRunning: input.plannerRunning === true,
    plannerCreatePending: input.plannerCreatePending === true,
    protoBusy: input.protoBusy === true,
  };
}

export function mergePendingImplementationPatchFromOrchestration(
  patch: PrototypeExecutionOrchestrationPersistInput | undefined,
): PendingImplementationPatch | null {
  if (!patch) return null;
  const next: PendingImplementationPatch = {};
  if (patch.implementationWorkPlanDraftV1 !== undefined) {
    next.implementationWorkPlanDraftV1 = patch.implementationWorkPlanDraftV1;
  }
  if (patch.implementationTaskPlanV1 !== undefined) {
    next.implementationTaskPlanV1 = patch.implementationTaskPlanV1;
  }
  if (patch.implementationTaskListV1 !== undefined) {
    next.implementationTaskListV1 = patch.implementationTaskListV1;
  }
  if (patch.cursorWorkItemsV1 !== undefined) {
    next.cursorWorkItemsV1 = patch.cursorWorkItemsV1;
  }
  if (patch.codeAgentWipExecutionV1 !== undefined) {
    next.codeAgentWipExecutionV1 = patch.codeAgentWipExecutionV1;
  }
  if (patch.taskCursorExecutionV1 !== undefined) {
    next.taskCursorExecutionV1 = patch.taskCursorExecutionV1;
  }
  if (patch.taskCursorExecutionHistoryV1 !== undefined) {
    next.taskCursorExecutionHistoryV1 = patch.taskCursorExecutionHistoryV1;
  }
  if (patch.implementationAutoQualityGateV1 !== undefined) {
    next.implementationAutoQualityGateV1 = patch.implementationAutoQualityGateV1;
  }
  if (patch.implementationAutoQualityGateHistoryV1 !== undefined) {
    next.implementationAutoQualityGateHistoryV1 = patch.implementationAutoQualityGateHistoryV1;
  }
  if (patch.implementationQualityGateResultsV1 !== undefined) {
    next.implementationQualityGateResultsV1 = patch.implementationQualityGateResultsV1;
  }
  if (patch.implementationTaskExecutionStateV1 !== undefined) {
    next.implementationTaskExecutionStateV1 = patch.implementationTaskExecutionStateV1;
  }
  if (patch.implementationExecutionBoardStateV1 !== undefined) {
    next.implementationExecutionBoardStateV1 = patch.implementationExecutionBoardStateV1;
  }
  if (patch.promptTimeline !== undefined) {
    next.promptTimeline = patch.promptTimeline;
  }
  if (patch.implementationExecutionJobsV1 !== undefined) {
    next.implementationExecutionJobsV1 = patch.implementationExecutionJobsV1;
  }
  if (patch.codeTaskExecutionRunsV1 !== undefined) {
    next.codeTaskExecutionRunsV1 = patch.codeTaskExecutionRunsV1;
  }
  if (patch.implementationRuntimeUiSnapshotV1 !== undefined) {
    next.implementationRuntimeUiSnapshotV1 = patch.implementationRuntimeUiSnapshotV1;
    delete next.implementationRuntimeStateV1;
  }
  if (
    patch.implementationRuntimeStateV1 !== undefined &&
    patch.implementationRuntimeUiSnapshotV1 === undefined
  ) {
    next.implementationRuntimeStateV1 = patch.implementationRuntimeStateV1;
  }
  if (patch.implementationIntegratedExecutionStateV1 !== undefined) {
    next.implementationIntegratedExecutionStateV1 = patch.implementationIntegratedExecutionStateV1;
  }
  if (patch.implementationPreviewScopeV1 !== undefined) {
    next.implementationPreviewScopeV1 = patch.implementationPreviewScopeV1;
  }
  if (patch.implementationPreviewRuntimeV1 !== undefined) {
    next.implementationPreviewRuntimeV1 = patch.implementationPreviewRuntimeV1;
  }
  return Object.keys(next).length > 0 ? next : null;
}

export function mergePendingImplementationPatch(
  prev: PendingImplementationPatch,
  incoming: PendingImplementationPatch | null,
): PendingImplementationPatch {
  if (!incoming) return prev;
  return {
    ...prev,
    ...(incoming.implementationWorkPlanDraftV1 !== undefined
      ? { implementationWorkPlanDraftV1: incoming.implementationWorkPlanDraftV1 }
      : {}),
    ...(incoming.implementationTaskPlanV1 !== undefined
      ? { implementationTaskPlanV1: incoming.implementationTaskPlanV1 }
      : {}),
    ...(incoming.implementationTaskListV1 !== undefined
      ? { implementationTaskListV1: incoming.implementationTaskListV1 }
      : {}),
    ...(incoming.cursorWorkItemsV1 !== undefined
      ? { cursorWorkItemsV1: incoming.cursorWorkItemsV1 }
      : {}),
    ...(incoming.codeAgentWipExecutionV1 !== undefined
      ? { codeAgentWipExecutionV1: incoming.codeAgentWipExecutionV1 }
      : {}),
    ...(incoming.taskCursorExecutionV1 !== undefined
      ? { taskCursorExecutionV1: incoming.taskCursorExecutionV1 }
      : {}),
    ...(incoming.taskCursorExecutionHistoryV1 !== undefined
      ? { taskCursorExecutionHistoryV1: incoming.taskCursorExecutionHistoryV1 }
      : {}),
    ...(incoming.implementationAutoQualityGateV1 !== undefined
      ? { implementationAutoQualityGateV1: incoming.implementationAutoQualityGateV1 }
      : {}),
    ...(incoming.implementationAutoQualityGateHistoryV1 !== undefined
      ? { implementationAutoQualityGateHistoryV1: incoming.implementationAutoQualityGateHistoryV1 }
      : {}),
    ...(incoming.implementationQualityGateResultsV1 !== undefined
      ? { implementationQualityGateResultsV1: incoming.implementationQualityGateResultsV1 }
      : {}),
    ...(incoming.implementationTaskExecutionStateV1 !== undefined
      ? { implementationTaskExecutionStateV1: incoming.implementationTaskExecutionStateV1 }
      : {}),
    ...(incoming.implementationExecutionBoardStateV1 !== undefined
      ? { implementationExecutionBoardStateV1: incoming.implementationExecutionBoardStateV1 }
      : {}),
    ...(incoming.promptTimeline !== undefined ? { promptTimeline: incoming.promptTimeline } : {}),
    ...(incoming.implementationExecutionJobsV1 !== undefined
      ? { implementationExecutionJobsV1: incoming.implementationExecutionJobsV1 }
      : {}),
    ...(incoming.codeTaskExecutionRunsV1 !== undefined
      ? { codeTaskExecutionRunsV1: incoming.codeTaskExecutionRunsV1 }
      : {}),
    ...(incoming.implementationRuntimeUiSnapshotV1 !== undefined
      ? { implementationRuntimeUiSnapshotV1: incoming.implementationRuntimeUiSnapshotV1 }
      : {}),
    ...(incoming.implementationRuntimeStateV1 !== undefined
      ? { implementationRuntimeStateV1: incoming.implementationRuntimeStateV1 }
      : {}),
    ...(incoming.implementationIntegratedExecutionStateV1 !== undefined
      ? { implementationIntegratedExecutionStateV1: incoming.implementationIntegratedExecutionStateV1 }
      : {}),
    ...(incoming.implementationPreviewScopeV1 !== undefined
      ? { implementationPreviewScopeV1: incoming.implementationPreviewScopeV1 }
      : {}),
    ...(incoming.implementationPreviewRuntimeV1 !== undefined
      ? { implementationPreviewRuntimeV1: incoming.implementationPreviewRuntimeV1 }
      : {}),
  };
}

export function canConfirmImplementationWorkPlanFromEffectiveState(
  state: EffectiveImplementationState,
): ImplementationWorkPlanConfirmGateResult {
  if (!hasImplementationWorkPlanDraftReady(state.implementationWorkPlanDraftV1)) {
    return {
      ok: false,
      message: "구현 작업안 초안이 없어 자동으로 생성할 수 없습니다. 구현 준비정보를 확인하거나 [구현 작업안 초안 생성]으로 복구해 주세요.",
    };
  }
  if (!state.designOk) {
    return {
      ok: false,
      message: "기획 산출물 준비 후 작업안을 확정할 수 있습니다.",
    };
  }
  return { ok: true };
}

/** CTA label → stage action id. Unmapped labels fall back to tryHandlePrototypeExecutionChip. */
export function mapImplementationChipToAction(label: string): ImplementationStageActionId | null {
  const reviewAction = mapReviewStageChipToAction(label);
  if (reviewAction) return reviewAction;
  switch (label.trim()) {
    case GENERATE_IMPLEMENTATION_TASK_LIST_CHIP:
    case "구현 작업목록 생성":
      return "GENERATE_IMPLEMENTATION_TASK_LIST";
    case WORK_PLAN_DRAFT_GENERATE_CHIP:
    case "구현 작업안 초안 생성":
      return "GENERATE_IMPLEMENTATION_WORK_PLAN";
    case "구현 작업안 확정":
      return "CONFIRM_IMPLEMENTATION_WORK_PLAN";
    case WORK_PLAN_SCOPE_DIRECT_INPUT_CHIP:
    case "구현 범위 수정":
    case "작업 범위 수정":
      return "EDIT_IMPLEMENTATION_SCOPE";
    case DB_INTEGRATION_REVIEW_CHIP:
      return "REVIEW_DB_INTEGRATION";
    case DATA_MODEL_DRAFT_CHIP:
      return "GENERATE_DATA_MODEL_DRAFT";
    case MOCK_IMPLEMENTATION_CHIP:
      return "CONFIRM_MOCK_IMPLEMENTATION";
    case IMPLEMENTATION_ARTIFACT_REVIEW_LABEL:
      return "SHOW_ARTIFACTS";
    case IMPLEMENTATION_ENV_SETTINGS_LABEL:
    case "환경설정 보기":
      return "OPEN_ENV_SETTINGS";
    case IMPLEMENTATION_ROLE_CHECK_VIEW_CHIP:
    case "역할별 점검 보기":
      return "SHOW_ROLE_CHECK";
    case "검수자 점검 실행":
    case REVIEWER_CHECK_RUN_CHIP:
      return "RUN_REVIEWER_CHECK";
    case "보안 점검 실행":
    case SECURITY_CHECK_RUN_CHIP:
      return "RUN_SECURITY_CHECK";
    case AI_DEVELOPER_REMEDIATION_REQUEST_CHIP:
    case IMPLEMENTATION_GENERATION_REQUEST_CHIP:
      return "REQUEST_CODE_AGENT_WIP";
    case IMPLEMENTATION_SCM_CHECK_VIEW_CHIP:
    case "SCM 점검 결과":
      return "SHOW_SCM_CHECK";
    case IMPLEMENTATION_ENVIRONMENT_CHECK_VIEW_CHIP:
    case "환경 점검 결과":
    case "환경설정 점검 결과":
      return "SHOW_ENV_CHECK";
    case CODE_AGENT_WIP_WORK_REQUEST_CHIP:
    case LEGACY_CURSOR_WIP_WORK_REQUEST_CHIP:
      return "REQUEST_CODE_AGENT_WIP";
    case REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP:
    case "Cursor 실행 요청":
      return "REQUEST_CURSOR_BRIDGE_EXECUTION";
    case AI_DEVELOPER_EXECUTION_REQUEST_CHIP:
      return "REQUEST_TASK_CURSOR_EXECUTION";
    case IMPLEMENTATION_QUICK_RUN_CHIP:
      return "START_IMPLEMENTATION_QUICK_RUN";
    case IMPLEMENTATION_FORCE_RELEASE_EXECUTION_CHIP:
      return "RELEASE_IMPLEMENTATION_EXECUTION_LOCK";
    case IMPLEMENTATION_RUNTIME_REDISPATCH_CHIP:
      return "REDISPATCH_IMPLEMENTATION_RUNTIME";
    case IMPLEMENTATION_RUNTIME_DIAGNOSTICS_CHIP:
      return "SHOW_IMPLEMENTATION_RUNTIME_DIAGNOSTICS";
    case VERIFY_TASK_CURSOR_GITHUB_CHIP:
      return "VERIFY_TASK_CURSOR_GITHUB";
    case RUN_REFACTOR_COMMON_CHIP:
      return "RUN_REFACTOR_COMMON";
    case RUN_INTEGRATED_REVIEW_CHIP:
      return "RUN_INTEGRATED_REVIEW";
    case RUN_INTEGRATED_SECURITY_CHIP:
      return "RUN_INTEGRATED_SECURITY";
    case RUN_FINAL_SCM_CHIP:
      return "RUN_FINAL_SCM";
    case RUN_PLATFORM_SCM_MERGE_CHIP:
      return "RUN_PLATFORM_SCM_MERGE";
    case IMPLEMENTATION_USER_CONFIRMATION_RESOLVE_CHIP:
    case IMPLEMENTATION_USER_CONFIRMATION_RESOLVE_ALL_CHIP:
      return "RESOLVE_USER_CONFIRMATION";
    case IMPLEMENTATION_USER_CONFIRMATION_VIEW_CHIP:
      return "SHOW_USER_CONFIRMATION_ITEMS";
    case MOVE_TO_REVIEW_STAGE_CHIP:
      return "MOVE_TO_REVIEW_STAGE";
    case QUICK_DESIGN_CONFIRM_ACTION_LABEL:
      return "CONFIRM_QUICK_DESIGN_FOR_IMPLEMENTATION";
    case CREATE_IMPLEMENTATION_SEED_FROM_QUICK_DESIGN_DRAFT_LABEL:
      return "CREATE_IMPLEMENTATION_SEED_FROM_QUICK_DESIGN_DRAFT";
    case START_QUICK_DESIGN_FROM_IMPLEMENTATION_LABEL:
      return "START_QUICK_DESIGN_FROM_IMPLEMENTATION";
    case IMPLEMENTATION_BLOCKED_RETURN_TO_PLANNING_CHIP:
    case "기획단계로 이동":
      return "RETURN_TO_PLANNING_STAGE";
    default:
      return null;
  }
}
