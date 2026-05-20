import { describe, expect, it } from "vitest";
import {
  buildRequirementsAgentMetadata,
  resolveDispatchAgent,
  resolveDispatchCapability,
} from "@/lib/agents/requirementsDispatchAgentMetadata";
import { dispatchRequirementsUserIntent, buildRequirementsIntentDispatchContext } from "@/lib/requirements/requirementsIntentDispatch";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { seedFeatureDetailSlotsFromServiceFlow } from "@/lib/requirements/featureDetailSlots";
import { createSampleServiceFlow, ORCHESTRATION_REGRESSION_NOW } from "../orchestration/helpers/orchestrationRegressionHarness";
import { clearIntentRouterCache } from "@/lib/requirements/requirementsIntentRouterCache";

const now = ORCHESTRATION_REGRESSION_NOW;

function featureDetailState() {
  const flow = createSampleServiceFlow({ conversationState: "FEATURE_DETAIL" });
  const seeded = seedFeatureDetailSlotsFromServiceFlow(flow, now);
  return parseRequirementsStateJson({
    serviceFlowV1: flow,
    requirementsOrchestrationStageV1: { activePhase: "FEATURE_DETAIL", updatedAt: now },
    featureDetailSlotsV1: { ...seeded, focusFeatureId: null },
  });
}

describe("multi-agent dispatch metadata stage 2-1", () => {
  it("resolveDispatchAgent maps ideation to ai-planner", () => {
    const r = resolveDispatchAgent({ intentToken: "ideation", stage: "IDEATION" });
    expect(r.agentId).toBe("ai-planner");
    expect(r.source).not.toBe("none");
  });

  it("resolveDispatchAgent maps prototype_build token to ai-developer", () => {
    const r = resolveDispatchAgent({ intentToken: "prototype_build" });
    expect(r.agentId).toBe("ai-developer");
  });

  it("resolveDispatchAgent maps security_review to ai-security", () => {
    const r = resolveDispatchAgent({ intentToken: "security_review" });
    expect(r.agentId).toBe("ai-security");
  });

  it("unknown intent does not throw and returns warning or none", () => {
    expect(() =>
      resolveDispatchAgent({ intentToken: "totally_unknown_intent_xyz", stage: "UNKNOWN_STAGE_XYZ" }),
    ).not.toThrow();
    const r = resolveDispatchAgent({ intentToken: "totally_unknown_intent_xyz", stage: "UNKNOWN_STAGE_XYZ" });
    expect(r.agentId).toBeUndefined();
    expect(r.source).toBe("none");
    expect(r.warnings?.length).toBeGreaterThan(0);
  });

  it("resolveDispatchCapability returns planner default capability", () => {
    const r = resolveDispatchCapability({ agentId: "ai-planner", intentToken: "ideation" });
    expect(r.capabilityId).toBe("project.idea.structure");
    expect(r.validBinding).toBe(true);
  });

  it("resolveDispatchCapability uses validateAgentCapabilityBinding", () => {
    const valid = resolveDispatchCapability({
      agentId: "ai-developer",
      suggestedActionId: "GENERATE_DOCUMENT",
    });
    expect(valid.validBinding).toBe(true);
    expect(valid.capabilityId).toBe("cursor.implementation.plan");

    const invalid = resolveDispatchCapability({
      agentId: "ai-planner",
      suggestedActionId: "GENERATE_DOCUMENT",
    });
    expect(invalid.validBinding).toBe(false);
    expect(invalid.warnings?.length).toBeGreaterThan(0);
  });

  it("buildRequirementsAgentMetadata produces agentId capabilityId and lastAgentEvent", () => {
    const meta = buildRequirementsAgentMetadata({
      projectId: "proj-1",
      stage: "FEATURE_DETAIL",
      suggestedActionId: "EDIT_FEATURES",
      runtimeRole: "orchestration-architect",
    });
    expect(meta?.agentId).toBeDefined();
    expect(meta?.capabilityId).toBeDefined();
    expect(meta?.lastAgentEvent?.agentId).toBe(meta?.agentId);
    expect(meta?.lastAgentEvent?.projectId).toBe("proj-1");
  });

  it("buildRequirementsAgentMetadata reflects runId taskId conversationId", () => {
    const meta = buildRequirementsAgentMetadata({
      projectId: "p1",
      conversationId: "c1",
      runId: "r1",
      taskId: "t1",
      stage: "IDEATION",
      intentToken: "ideation",
    });
    expect(meta?.lastAgentEvent?.conversationId).toBe("c1");
    expect(meta?.lastAgentEvent?.runId).toBe("r1");
    expect(meta?.lastAgentEvent?.taskId).toBe("t1");
  });

  it("buildRequirementsAgentMetadata does not throw on unknown intent", () => {
    expect(() =>
      buildRequirementsAgentMetadata({ intentToken: "unknown_xyz", stage: "NO_STAGE" }),
    ).not.toThrow();
    const meta = buildRequirementsAgentMetadata({ intentToken: "unknown_xyz", stage: "NO_STAGE" });
    expect(meta?.agentId).toBeUndefined();
  });

  it("dispatchRequirementsUserIntent attaches optional agentRuntimeMetadata", () => {
    clearIntentRouterCache();
    const state = featureDetailState();
    const ctx = buildRequirementsIntentDispatchContext(state);
    const dispatch = dispatchRequirementsUserIntent({
      userMessage: "기능 수정해줘",
      directQuickActionId: "EDIT_FEATURES",
      ctx,
      routingState: state,
    });
    expect(dispatch.agentRuntimeMetadata).toBeDefined();
    expect(dispatch.agentRuntimeMetadata?.agentId).toBeDefined();
    expect(dispatch.timelineDetail).toContain("agentId:");
  });
});
