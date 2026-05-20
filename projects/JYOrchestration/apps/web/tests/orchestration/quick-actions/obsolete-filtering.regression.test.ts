import { describe, expect, it } from "vitest";
import {
  assertAllowedActions,
  assertObsoleteActionsRemoved,
  buildQuickActionProjection,
  createMockOrchestrationState,
  createSampleServiceFlow,
  FEATURE_DETAIL_ALLOWED_ACTION_IDS,
  FEATURE_DETAIL_OBSOLETE_ACTION_IDS,
  filterActionsForStage,
  ORCHESTRATION_REGRESSION_NOW,
} from "../helpers/orchestrationRegressionHarness";
import { getOrchestrationStageDefinition } from "@/lib/requirements/requirementsOrchestrationRegistry";

describe("orchestration regression — obsolete action filtering", () => {
  it("FEATURE_DETAIL registry obsolete list covers prior-stage actions", () => {
    const def = getOrchestrationStageDefinition("FEATURE_DETAIL");
    for (const id of FEATURE_DETAIL_OBSOLETE_ACTION_IDS) {
      expect(def.obsoleteActionIds).toContain(id);
    }
    for (const id of FEATURE_DETAIL_ALLOWED_ACTION_IDS) {
      expect(def.allowedActionIds).toContain(id);
    }
  });

  it("after FEATURE_DETAIL entry projection excludes obsolete actionIds", () => {
    const flow = createSampleServiceFlow({
      conversationState: "FEATURE_DETAIL",
      flowApproved: true,
      proposalAcceptedAt: ORCHESTRATION_REGRESSION_NOW,
    });
    const state = createMockOrchestrationState({
      stage: "FEATURE_DETAIL",
      flow,
      completedStages: ["SERVICE_FLOW_REVIEW"],
    });

    const polluted = filterActionsForStage(
      "FEATURE_DETAIL",
      [
        ...FEATURE_DETAIL_OBSOLETE_ACTION_IDS,
        ...FEATURE_DETAIL_ALLOWED_ACTION_IDS,
      ].map((id) => ({ id, label: `display-${id}` })),
    );
    assertObsoleteActionsRemoved("FEATURE_DETAIL", polluted);
    assertAllowedActions("FEATURE_DETAIL", polluted);
    expect(polluted.map((a) => a.id)).toEqual([...FEATURE_DETAIL_ALLOWED_ACTION_IDS]);

    const projection = buildQuickActionProjection({ state, stage: "FEATURE_DETAIL" });
    assertObsoleteActionsRemoved("FEATURE_DETAIL", projection.quickActions);
    expect(projection.quickActions.map((a) => a.id)).toEqual([...FEATURE_DETAIL_ALLOWED_ACTION_IDS]);
  });
});
