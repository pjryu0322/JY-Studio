import { describe, expect, it } from "vitest";
import {
  buildProjection,
  buildQuickActionProjection,
  createMockOrchestrationState,
  createSampleServiceFlow,
  dispatchQuickAction,
  ORCHESTRATION_REGRESSION_NOW,
} from "../helpers/orchestrationRegressionHarness";
import { applyRequirementsOrchestrationTransition } from "@/lib/requirements/requirementsTransitionEngine";

describe("orchestration regression — internal fast-path chain", () => {
  it("quickActionId → transition engine → state patch → projection update", () => {
    const flow = createSampleServiceFlow({
      conversationState: "APPROVED",
      proposalAcceptedAt: ORCHESTRATION_REGRESSION_NOW,
      flowApproved: true,
    });
    const state = createMockOrchestrationState({ stage: "SERVICE_FLOW_REVIEW", flow });

    const engine = applyRequirementsOrchestrationTransition({
      state,
      currentFlow: flow,
      proposalDecision: null,
      quickActionId: "NEXT_STAGE",
      quickActionLabel: "다음 단계 진행",
      slotDefinitions: undefined,
      nowIso: ORCHESTRATION_REGRESSION_NOW,
    });

    expect(engine.transitionResult).toBe("applied");
    expect(engine.fastPath).not.toBeNull();
    expect(engine.projectionUpdated).toBe(true);
    expect(engine.signal?.targetStage).toBe("FEATURE_DETAIL");

    const merged = {
      ...state,
      serviceFlowV1: engine.updatedFlow ?? flow,
      requirementsOrchestrationStageV1:
        engine.requirementsStatePatch?.requirementsOrchestrationStageV1 ??
        state.requirementsOrchestrationStageV1,
      featurePlanningSlotsV1: engine.requirementsStatePatch?.featurePlanningSlotsV1,
      singleChatOrchestrationV1:
        engine.requirementsStatePatch?.singleChatOrchestrationV1 ?? state.singleChatOrchestrationV1,
    };

    const view = buildProjection({ state: merged });
    expect(view.authoritativeStage).toBe("FEATURE_DETAIL");

    const quick = buildQuickActionProjection({ state: merged });
    expect(quick.quickActions.every((a) => a.id !== "APPROVE_FLOW")).toBe(true);
    expect(quick.quickActions.every((a) => a.id !== "APPLY_PROPOSAL")).toBe(true);
  });

  it("dispatchQuickAction wrapper matches engine output shape", () => {
    const flow = createSampleServiceFlow({ conversationState: "REVIEW" });
    const state = createMockOrchestrationState({ flow });
    const viaHelper = dispatchQuickAction({
      state,
      currentFlow: flow,
      quickActionId: "APPROVE_FLOW",
      quickActionLabel: "흐름 확정",
    });
    expect(viaHelper.transitionTriggered).toBe(true);
    expect(viaHelper.updatedFlow?.flowApproved).toBe(true);
  });
});
