import { describe, expect, it } from "vitest";
import {
  applyProjectSingleChatBoundaryGuard,
  shouldBlockProjectOrchestrationActionForServiceFlowSubIntent,
  shouldEnterManualActorEditFromSingleChat,
} from "@/lib/requirements/projectSingleChatBoundaryGuard";
import { buildServiceFlowResponsePolicyFromDispatch } from "@/lib/requirements/serviceFlowAdviceMode";
import { buildIntentRouterSystemPromptForTest } from "@/lib/requirements/requirementsIntentRouterLlm";
import type { IntentRoutingResult } from "@/lib/requirements/requirementsIntentRouterTypes";

function intent(partial: Partial<IntentRoutingResult>): IntentRoutingResult {
  return {
    intentType: "orchestration_action",
    suggestedActionId: null,
    confidence: 0.9,
    reason: "test",
    clarificationQuestion: "",
    executionIntent: "ask_advice",
    actionInvocationStrength: "weak",
    routerMode: "deterministic",
    stageIntent: "general_advice",
    serviceFlowSubIntent: "general_service_flow",
    extractedTargets: { featureIds: [], stepIds: [], actorIds: [] },
    ...partial,
  };
}

describe("projectSingleChatBoundaryGuard", () => {
  it("downgrades ADD_ACTOR to DIRECT_INPUT for actor_definition in Project SingleChat", () => {
    const result = shouldBlockProjectOrchestrationActionForServiceFlowSubIntent({
      executionScope: "project_single_chat",
      stageIntent: "service_flow",
      serviceFlowSubIntent: "actor_definition",
      suggestedActionId: "ADD_ACTOR",
    });

    expect(result.blocked).toBe(true);
    expect(result.downgradedTo).toBe("DIRECT_INPUT");
    expect(result.reason).toBe("actor_definition_is_not_manual_add_actor");
  });

  it("does not block ADD_ACTOR for manual service actor add CTA", () => {
    const result = shouldBlockProjectOrchestrationActionForServiceFlowSubIntent({
      executionScope: "project_single_chat",
      stageIntent: "service_flow",
      serviceFlowSubIntent: "actor_definition",
      suggestedActionId: "ADD_ACTOR",
      directCtaId: "MANUAL_SERVICE_ACTOR_ADD",
    });

    expect(result.blocked).toBe(false);
  });

  it("applyProjectSingleChatBoundaryGuard sets flow_update policy inputs", () => {
    const routedIntent = intent({
      suggestedActionId: "ADD_ACTOR",
      stageIntent: "service_flow",
      serviceFlowSubIntent: "actor_definition",
    });
    const applied = applyProjectSingleChatBoundaryGuard({
      intent: routedIntent,
      guard: { allowed: true, effectiveActionId: "ADD_ACTOR" },
      effectiveActionId: "ADD_ACTOR",
      executionScope: "project_single_chat",
    });

    expect(applied.effectiveActionId).toBe("DIRECT_INPUT");
    expect(applied.boundaryGuardTrace).toContain("[projectSingleChatBoundaryGuard]");
    expect(applied.boundaryGuardTrace).toContain("downgradedTo=DIRECT_INPUT");

    const policy = buildServiceFlowResponsePolicyFromDispatch({
      intent: applied.intent,
      guard: applied.guard,
      effectiveActionId: applied.effectiveActionId,
      directQuickActionId: null,
      executionScope: "project_single_chat",
    });
    expect(policy.mode).toBe("flow_update");
    expect(policy.serviceFlowSubIntent).toBe("actor_definition");
  });

  it("does not enter manual actor edit for actor_definition quick reply", () => {
    expect(
      shouldEnterManualActorEditFromSingleChat({
        effectiveActionId: "ADD_ACTOR",
        serviceFlowSubIntent: "actor_definition",
        source: "quick_reply",
      }),
    ).toBe(false);
  });

  it("allows manual actor edit only from manual editor source", () => {
    expect(
      shouldEnterManualActorEditFromSingleChat({
        effectiveActionId: "ADD_ACTOR",
        source: "manual_editor",
        directCtaId: "MANUAL_SERVICE_ACTOR_ADD",
      }),
    ).toBe(true);
  });

  it("intent router prompt includes actor_definition boundary rule", () => {
    const prompt = buildIntentRouterSystemPromptForTest();
    expect(prompt).toContain("actor_definition");
    expect(prompt).toContain("Do NOT return ADD_ACTOR for actor_definition");
  });
});
