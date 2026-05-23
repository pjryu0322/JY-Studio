import { describe, expect, it } from "vitest";
import { formatProjectSingleChatStageRoutingTrace } from "@/lib/requirements/singleChatStageTrace";

describe("singleChatStageTrace", () => {
  it("formats stage routing trace", () => {
    const trace = formatProjectSingleChatStageRoutingTrace({
      route: {
        stageIntent: "screen_planning",
        shouldRunServiceFlowAnalyze: false,
        shouldRunAdviceToFlowApply: false,
        shouldRunFlowReview: false,
        shouldRouteToScreenPlanning: true,
        shouldRouteToFeaturePlanning: false,
        shouldRouteToGenerationPrepare: false,
        reason: "router_stage_screen_planning",
      },
      source: "llm_stage_intent",
      routerStageIntent: "screen_planning",
    });

    expect(trace).toContain("[projectSingleChatStageRouter]");
    expect(trace).toContain("stageIntent=screen_planning");
    expect(trace).toContain("shouldRouteToScreenPlanning=true");
    expect(trace).toContain("source=llm_stage_intent");
  });
});
