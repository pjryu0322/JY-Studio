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
  LEGACY_CURSOR_EXECUTION_REQUEST_CHIP,
  LEGACY_CURSOR_WIP_WORK_REQUEST_CHIP,
} from "@/lib/prototype/codeAgentWipExecution";
import type { ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import {
  IMPLEMENTATION_ARTIFACT_REVIEW_LABEL,
  IMPLEMENTATION_ENV_SETTINGS_LABEL,
  REVIEWER_CHECK_RUN_CHIP,
  SECURITY_CHECK_RUN_CHIP,
  AI_DEVELOPER_REMEDIATION_REQUEST_CHIP,
  IMPLEMENTATION_GENERATION_REQUEST_CHIP,
  RUN_FINAL_SCM_CHIP,
  RUN_INTEGRATED_REVIEW_CHIP,
  RUN_INTEGRATED_SECURITY_CHIP,
  RUN_REFACTOR_COMMON_CHIP,
} from "@/lib/requirements/implementationUxLabels";

export type ImplementationStageActionId =
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
  | "RUN_REVIEWER_CHECK"
  | "RUN_SECURITY_CHECK"
  | "RUN_REFACTOR_COMMON"
  | "RUN_INTEGRATED_REVIEW"
  | "RUN_INTEGRATED_SECURITY"
  | "RUN_FINAL_SCM";

export type PendingImplementationPatch = Readonly<{
  implementationWorkPlanDraftV1?: ImplementationWorkPlanDraftV1 | null;
  implementationTaskPlanV1?: ImplementationTaskPlanV1 | null;
}>;

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
}): boolean {
  const isInitial =
    input.prevPersistedDraftUpdatedAt === undefined &&
    input.prevPersistedTaskPlanCreatedAt === undefined;
  if (isInitial) return false;
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
  const next: {
    implementationWorkPlanDraftV1?: ImplementationWorkPlanDraftV1 | null;
    implementationTaskPlanV1?: ImplementationTaskPlanV1 | null;
  } = {};
  if (patch.implementationWorkPlanDraftV1 !== undefined) {
    next.implementationWorkPlanDraftV1 = patch.implementationWorkPlanDraftV1;
  }
  if (patch.implementationTaskPlanV1 !== undefined) {
    next.implementationTaskPlanV1 = patch.implementationTaskPlanV1;
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
  switch (label.trim()) {
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
    case LEGACY_CURSOR_EXECUTION_REQUEST_CHIP:
      return "REQUEST_CODE_AGENT_WIP";
    case RUN_REFACTOR_COMMON_CHIP:
      return "RUN_REFACTOR_COMMON";
    case RUN_INTEGRATED_REVIEW_CHIP:
      return "RUN_INTEGRATED_REVIEW";
    case RUN_INTEGRATED_SECURITY_CHIP:
      return "RUN_INTEGRATED_SECURITY";
    case RUN_FINAL_SCM_CHIP:
      return "RUN_FINAL_SCM";
    default:
      return null;
  }
}
