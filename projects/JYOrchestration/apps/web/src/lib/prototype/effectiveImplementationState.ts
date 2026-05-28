import {
  hasImplementationWorkPlanDraftReady,
  WORK_PLAN_DRAFT_GENERATE_CHIP,
  type ImplementationWorkPlanDraftV1,
} from "@/lib/prototype/implementationWorkPlanDraft";
import type { ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";

export type ImplementationStageActionId =
  | "GENERATE_IMPLEMENTATION_WORK_PLAN"
  | "CONFIRM_IMPLEMENTATION_WORK_PLAN";

export type PendingImplementationPatch = Readonly<{
  implementationWorkPlanDraftV1?: ImplementationWorkPlanDraftV1 | null;
  implementationTaskPlanV1?: ImplementationTaskPlanV1 | null;
}>;

export type EffectiveImplementationState = Readonly<{
  implementationSeedV1: ImplementationSeedV1 | null;
  implementationWorkPlanDraftV1: ImplementationWorkPlanDraftV1 | null;
  implementationTaskPlanV1: ImplementationTaskPlanV1 | null;
  envOk: boolean;
  designOk: boolean;
  latestRun: PrototypeRun | null;
  hasWorkUnits: boolean;
  plannerRunning: boolean;
  plannerCreatePending: boolean;
  protoBusy: boolean;
}>;

export type ImplementationWorkPlanConfirmGateResult =
  | Readonly<{ readonly ok: true }>
  | Readonly<{ readonly ok: false; readonly message: string }>;

export function resolveEffectiveImplementationState(input: {
  readonly parsedRequirementsState: {
    readonly implementationSeedV1?: ImplementationSeedV1 | null;
    readonly implementationWorkPlanDraftV1?: ImplementationWorkPlanDraftV1 | null;
    readonly implementationTaskPlanV1?: ImplementationTaskPlanV1 | null;
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
    implementationWorkPlanDraftV1:
      input.pendingPatch?.implementationWorkPlanDraftV1 ??
      input.parsedRequirementsState.implementationWorkPlanDraftV1 ??
      null,
    implementationTaskPlanV1:
      input.pendingPatch?.implementationTaskPlanV1 ??
      input.parsedRequirementsState.implementationTaskPlanV1 ??
      null,
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
      message: "먼저 [구현 작업안 초안 생성]을 진행해 주세요.",
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

/** CTA label → stage action id (phase-1 mapping; execution still uses chip handlers). */
export function mapImplementationChipToAction(label: string): ImplementationStageActionId | null {
  switch (label.trim()) {
    case WORK_PLAN_DRAFT_GENERATE_CHIP:
      return "GENERATE_IMPLEMENTATION_WORK_PLAN";
    case "구현 작업안 확정":
      return "CONFIRM_IMPLEMENTATION_WORK_PLAN";
    default:
      return null;
  }
}
