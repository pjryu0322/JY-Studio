import { describe, expect, it } from "vitest";
import {
  assertStageTransitionAllowed,
  buildProjection,
  buildQuickActionProjection,
  createMockOrchestrationState,
  createSampleServiceFlow,
  dispatchQuickAction,
  ORCHESTRATION_REGRESSION_NOW,
} from "../helpers/orchestrationRegressionHarness";
import { seedFeatureDetailSlotsFromServiceFlow } from "@/lib/requirements/featureDetailSlots";
import {
  isOrchestrationTransitionAllowed,
  resolveAuthoritativeOrchestrationStage,
} from "@/lib/requirements/requirementsOrchestrationRegistry";

describe("orchestration regression — stage transition", () => {
  it("authoritative stage chain: IDEATION → SERVICE_FLOW → REVIEW → FEATURE_DETAIL → DOCUMENTATION", () => {
    assertStageTransitionAllowed("IDEATION", "SERVICE_FLOW");
    assertStageTransitionAllowed("SERVICE_FLOW", "SERVICE_FLOW_REVIEW");
    assertStageTransitionAllowed("SERVICE_FLOW_REVIEW", "FEATURE_DETAIL");
    assertStageTransitionAllowed("SERVICE_FLOW_REVIEW", "DOCUMENTATION_COMPLETE");
    expect(isOrchestrationTransitionAllowed("IDEATION", "FEATURE_DETAIL")).toBe(false);
  });

  it("NEXT_STAGE updates orchestration stage patch and projection", () => {
    const flow = createSampleServiceFlow({
      conversationState: "APPROVED",
      proposalAcceptedAt: ORCHESTRATION_REGRESSION_NOW,
      flowApproved: true,
    });
    const state = createMockOrchestrationState({ stage: "SERVICE_FLOW_REVIEW", flow });
    const result = dispatchQuickAction({
      state,
      currentFlow: flow,
      quickActionId: "NEXT_STAGE",
    });

    expect(result.transitionResult).toBe("applied");
    expect(result.transitionTriggered).toBe(true);
    expect(result.signal?.targetStage).toBe("FEATURE_DETAIL");
    expect(result.requirementsStatePatch?.requirementsOrchestrationStageV1?.currentStage).toBe(
      "FEATURE_DETAIL",
    );

    const merged: typeof state = {
      ...state,
      serviceFlowV1: result.updatedFlow ?? flow,
      requirementsOrchestrationStageV1:
        result.requirementsStatePatch?.requirementsOrchestrationStageV1 ??
        state.requirementsOrchestrationStageV1,
      featurePlanningSlotsV1: result.requirementsStatePatch?.featurePlanningSlotsV1,
      featureDetailSlotsV1:
        result.requirementsStatePatch?.featureDetailSlotsV1 ??
        seedFeatureDetailSlotsFromServiceFlow(result.updatedFlow ?? flow, ORCHESTRATION_REGRESSION_NOW),
    };
    expect(resolveAuthoritativeOrchestrationStage(merged)).toBe("FEATURE_DETAIL");

    const projection = buildProjection({ state: merged });
    expect(projection.authoritativeStage).toBe("FEATURE_DETAIL");
    expect(projection.workspaceStage).toBe("feature-planning");

    const quick = buildQuickActionProjection({ state: merged, stage: "FEATURE_DETAIL" });
    expect(quick.quickActions.map((a) => a.id)).toEqual(["EDIT_FEATURES", "GENERATE_DOCUMENT"]);
    expect(quick.featureDetail.featureCount).toBeGreaterThan(0);
  });

  it("DEFINE_SCREEN transitions to screen_define phase with bootstrap reply", () => {
    const flow = createSampleServiceFlow({
      conversationState: "FEATURE_DETAIL",
      proposalAcceptedAt: ORCHESTRATION_REGRESSION_NOW,
      flowApproved: true,
    });
    const detailSeed = seedFeatureDetailSlotsFromServiceFlow(flow, ORCHESTRATION_REGRESSION_NOW);
    const state = createMockOrchestrationState({
      stage: "FEATURE_DETAIL",
      flow,
      completedStages: ["SERVICE_FLOW_REVIEW"],
    });
    const stateWithConfirmed = {
      ...state,
      featureDetailSlotsV1: {
        ...detailSeed,
        slots: detailSeed.slots.map((s) => ({ ...s, status: "confirmed" as const, updatedAt: ORCHESTRATION_REGRESSION_NOW })),
      },
    };
    const result = dispatchQuickAction({
      state: stateWithConfirmed,
      currentFlow: flow,
      quickActionId: "DEFINE_SCREEN",
    });

    expect(result.transitionResult).toBe("applied");
    expect(result.transitionTriggered).toBe(true);
    expect(result.signal?.targetStage).toBe("SCREEN_DEFINE");
    expect(String(result.fastPath?.assistantMessage ?? "")).toContain("화면 정의");
    expect(result.requirementsStatePatch?.requirementsOrchestrationStageV1?.activePhase).toBe(
      "screen_define",
    );

    const merged: typeof state = {
      ...state,
      serviceFlowV1: result.updatedFlow ?? flow,
      requirementsOrchestrationStageV1:
        result.requirementsStatePatch?.requirementsOrchestrationStageV1 ??
        state.requirementsOrchestrationStageV1,
    };
    expect(resolveAuthoritativeOrchestrationStage(merged)).toBe("SCREEN_DEFINE");
  });

});
