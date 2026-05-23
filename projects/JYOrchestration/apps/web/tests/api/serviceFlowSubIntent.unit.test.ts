import { describe, expect, it } from "vitest";
import { parseLlmIntentJsonForTest } from "@/lib/requirements/requirementsIntentRouterLlm";
import {
  isServiceFlowStructuralSubIntent,
  shouldBlockApplyProposalForServiceFlowSubIntent,
} from "@/lib/requirements/serviceFlowSubIntent";
import { createSampleServiceFlow } from "../orchestration/helpers/orchestrationRegressionHarness";

describe("serviceFlowSubIntent — structural", () => {
  it("identifies actor_definition as structural subIntent", () => {
    expect(isServiceFlowStructuralSubIntent("actor_definition")).toBe(true);
    expect(isServiceFlowStructuralSubIntent("flow_review")).toBe(false);
    expect(isServiceFlowStructuralSubIntent("general_service_flow")).toBe(false);
  });
});

describe("serviceFlowSubIntent — APPLY guard", () => {
  it("blocks APPLY_PROPOSAL for actor definition when flow is not reviewable", () => {
    const result = shouldBlockApplyProposalForServiceFlowSubIntent({
      suggestedActionId: "APPLY_PROPOSAL",
      serviceFlowSubIntent: "actor_definition",
      currentFlow: createSampleServiceFlow({ steps: [], actors: [] }),
      directQuickActionId: null,
    });

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("actor_definition_is_not_apply");
  });

  it("allows APPLY_PROPOSAL for direct apply when flow is reviewable", () => {
    const base = createSampleServiceFlow();
    const flow = createSampleServiceFlow({
      steps: [
        ...base.steps,
        {
          id: "s3",
          title: "Review",
          purpose: "p",
          order: 3,
          primaryActorId: "a1",
          secondaryActorIds: [],
          approved: false,
          updatedAt: base.updatedAt,
        },
      ],
    });
    const result = shouldBlockApplyProposalForServiceFlowSubIntent({
      suggestedActionId: "APPLY_PROPOSAL",
      serviceFlowSubIntent: "flow_apply",
      currentFlow: flow,
      directQuickActionId: "APPLY_PROPOSAL",
    });

    expect(result.blocked).toBe(false);
  });

  it("blocks APPLY when flow is not reviewable and subIntent is flow_draft", () => {
    const result = shouldBlockApplyProposalForServiceFlowSubIntent({
      suggestedActionId: "APPLY_PROPOSAL",
      serviceFlowSubIntent: "flow_draft",
      currentFlow: createSampleServiceFlow({ steps: [] }),
      directQuickActionId: null,
    });

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("flow_draft_is_not_apply");
  });
});

describe("serviceFlowSubIntent — LLM parse", () => {
  it("parses serviceFlowSubIntent actor_definition", () => {
    const parsed = parseLlmIntentJsonForTest(
      JSON.stringify({
        intentType: "question",
        stageIntent: "service_flow",
        serviceFlowSubIntent: "actor_definition",
        suggestedActionId: "DIRECT_INPUT",
        confidence: 0.9,
        reason: "actor setup",
        executionIntent: "ask_advice",
        actionInvocationStrength: "weak",
      }),
      ["DIRECT_INPUT"],
    );

    expect(parsed?.serviceFlowSubIntent).toBe("actor_definition");
    expect(parsed?.stageIntent).toBe("service_flow");
  });
});
