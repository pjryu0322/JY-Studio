import { describe, expect, it } from "vitest";
import {
  isProjectSingleChatTransitionQuickAction,
  routeProjectSingleChatOrchestrationTransition,
  shouldCallAnalyzeForTransitionQuickAction,
} from "@/lib/requirements/projectSingleChatTransitionAction";

describe("projectSingleChatTransitionAction", () => {
  it("recognizes transition quick action ids", () => {
    expect(isProjectSingleChatTransitionQuickAction("APPROVE_FLOW")).toBe(true);
    expect(isProjectSingleChatTransitionQuickAction("NEXT_STAGE")).toBe(true);
    expect(isProjectSingleChatTransitionQuickAction("START_FEATURE_DETAIL")).toBe(true);
    expect(isProjectSingleChatTransitionQuickAction("REVIEW_FLOW")).toBe(false);
  });

  it("shouldCallAnalyzeForTransitionQuickAction only for transition chips", () => {
    expect(shouldCallAnalyzeForTransitionQuickAction({ quickActionId: "APPROVE_FLOW" })).toBe(true);
    expect(shouldCallAnalyzeForTransitionQuickAction({ quickActionId: "REVIEW_FLOW" })).toBe(false);
  });

  it("routeProjectSingleChatOrchestrationTransition maps APPROVE_FLOW and NEXT_STAGE", () => {
    const approve = routeProjectSingleChatOrchestrationTransition("APPROVE_FLOW");
    expect(approve?.shouldRunOrchestrationTransition).toBe(true);
    expect(approve?.reason).toBe("flow_approve_transition");

    const next = routeProjectSingleChatOrchestrationTransition("NEXT_STAGE");
    expect(next?.shouldRunOrchestrationTransition).toBe(true);
    expect(next?.reason).toBe("next_stage_transition");
    expect(next?.shouldRouteToFeaturePlanning).toBe(false);
  });
});
