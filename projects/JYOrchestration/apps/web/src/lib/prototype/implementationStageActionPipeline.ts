import {
  canConfirmImplementationWorkPlanFromEffectiveState,
  type EffectiveImplementationState,
  type ImplementationStageActionGateResult,
  type ImplementationStageActionId,
} from "@/lib/prototype/effectiveImplementationState";
import { hasImplementationWorkPlanDraftReady } from "@/lib/prototype/implementationWorkPlanDraft";

export type { ImplementationStageActionGateResult, ImplementationStageActionId };

export function evaluateImplementationStageActionGate(
  actionId: ImplementationStageActionId,
  state: EffectiveImplementationState,
): ImplementationStageActionGateResult {
  switch (actionId) {
    case "GENERATE_IMPLEMENTATION_WORK_PLAN": {
      if (!state.designOk) {
        return { ok: false, message: "기획 산출물 준비 후 작업안을 생성할 수 있습니다." };
      }
      if (!state.envOk) {
        return { ok: false, message: "환경 준비가 완료된 뒤 작업안을 생성할 수 있습니다." };
      }
      const seedReady =
        Boolean(state.implementationSeedV1?.readiness?.ready) &&
        state.implementationSeedV1?.lifecycleStatus !== "candidate";
      if (!seedReady) {
        return { ok: false, message: "구현 준비정보(Seed) 확인 후 작업안을 생성해 주세요." };
      }
      return { ok: true };
    }
    case "CONFIRM_IMPLEMENTATION_WORK_PLAN":
      return canConfirmImplementationWorkPlanFromEffectiveState(state);
    case "REVIEW_DB_INTEGRATION": {
      if (
        state.implementationTaskPlanV1 ||
        hasImplementationWorkPlanDraftReady(state.implementationWorkPlanDraftV1)
      ) {
        return { ok: true };
      }
      return { ok: false, message: "먼저 [구현 작업안 초안 생성]을 진행해 주세요." };
    }
    case "GENERATE_DATA_MODEL_DRAFT": {
      const dbStrategy = state.implementationDbStrategyV1;
      if (state.implementationTaskPlanV1 || dbStrategy?.dbDecisionRequested) {
        return { ok: true };
      }
      return {
        ok: false,
        message: "DB 연동 필요성 검토 또는 구현 작업안 확정 후 진행해 주세요.",
      };
    }
    case "CONFIRM_MOCK_IMPLEMENTATION": {
      if (
        state.implementationTaskPlanV1 ||
        hasImplementationWorkPlanDraftReady(state.implementationWorkPlanDraftV1)
      ) {
        return { ok: true };
      }
      return { ok: false, message: "먼저 [구현 작업안 초안 생성]을 진행해 주세요." };
    }
    case "OPEN_ENV_SETTINGS":
    case "SHOW_ARTIFACTS":
    case "SHOW_ROLE_CHECK":
    case "SHOW_SCM_CHECK":
    case "SHOW_ENV_CHECK":
    case "EDIT_IMPLEMENTATION_SCOPE":
      return { ok: true };
    case "REQUEST_CODE_AGENT_WIP": {
      if (!state.implementationTaskPlanV1) {
        return { ok: false, message: "먼저 [구현 작업안 확정]으로 작업 계획을 확정해 주세요." };
      }
      if (!state.envOk) {
        return { ok: false, message: "환경 준비가 완료된 뒤 Code Agent WIP 작업을 요청할 수 있습니다." };
      }
      return { ok: true };
    }
  }
}
