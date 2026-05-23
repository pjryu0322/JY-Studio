import { describe, expect, it } from "vitest";
import {
  applyProjectSingleChatBoundaryGuard,
  shouldBlockProjectOrchestrationActionForServiceFlowSubIntent,
  shouldBlockProjectSingleChatOrchestrationAction,
  shouldEnterManualActorEditFromSingleChat,
} from "@/lib/requirements/projectSingleChatBoundaryGuard";
import { buildServiceFlowResponsePolicyFromDispatch } from "@/lib/requirements/serviceFlowAdviceMode";
import { finalizeRequirementsIntentDispatchForTest } from "@/lib/requirements/requirementsIntentDispatch";
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
    const result = shouldBlockProjectSingleChatOrchestrationAction({
      executionScope: "project_single_chat",
      stageIntent: "service_flow",
      serviceFlowSubIntent: "actor_definition",
      suggestedActionId: "ADD_ACTOR",
      source: "typed_text",
    });

    expect(result.blocked).toBe(true);
    expect(result.downgradedTo).toBe("DIRECT_INPUT");
    expect(result.reason).toBe("actor_definition_is_not_manual_add_actor");
  });

  it("blocks ADD_ACTOR in Project SingleChat typed text even without actor_definition subIntent", () => {
    const result = shouldBlockProjectSingleChatOrchestrationAction({
      executionScope: "project_single_chat",
      stageIntent: "service_flow",
      serviceFlowSubIntent: "general_service_flow",
      suggestedActionId: "ADD_ACTOR",
      source: "typed_text",
    });

    expect(result.blocked).toBe(true);
    expect(result.downgradedTo).toBe("DIRECT_INPUT");
    expect(result.reason).toBe("project_single_chat_blocks_add_actor");
  });

  it("blocks ADD_ACTOR in Project SingleChat quick reply unless manual editor CTA", () => {
    const result = shouldBlockProjectSingleChatOrchestrationAction({
      executionScope: "project_single_chat",
      stageIntent: "service_flow",
      suggestedActionId: "ADD_ACTOR",
      directQuickActionId: "ADD_ACTOR",
      source: "quick_reply",
    });

    expect(result.blocked).toBe(true);
    expect(result.downgradedTo).toBe("DIRECT_INPUT");
  });

  it("allows ADD_ACTOR only from manual editor source with manual service actor CTA", () => {
    const result = shouldBlockProjectSingleChatOrchestrationAction({
      executionScope: "project_single_chat",
      stageIntent: "service_flow",
      suggestedActionId: "ADD_ACTOR",
      source: "manual_editor",
      directCtaId: "MANUAL_SERVICE_ACTOR_ADD",
    });

    expect(result.blocked).toBe(false);
  });

  it("legacy shouldBlockProjectOrchestrationActionForServiceFlowSubIntent delegates to full block", () => {
    const result = shouldBlockProjectOrchestrationActionForServiceFlowSubIntent({
      executionScope: "project_single_chat",
      stageIntent: "service_flow",
      serviceFlowSubIntent: "general_service_flow",
      suggestedActionId: "ADD_ACTOR",
      source: "typed_text",
    });

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("project_single_chat_blocks_add_actor");
  });

  it("applyProjectSingleChatBoundaryGuard sets flow_update policy inputs for actor_definition", () => {
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
      source: "typed_text",
    });

    expect(applied.effectiveActionId).toBe("DIRECT_INPUT");
    expect(applied.boundaryGuardTrace).toContain("[projectSingleChatBoundaryGuard]");
    expect(applied.boundaryGuardTrace).toContain("source=typed_text");
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

  it("does not enter manual actor edit without manual_editor source", () => {
    expect(
      shouldEnterManualActorEditFromSingleChat({
        effectiveActionId: "ADD_ACTOR",
        serviceFlowSubIntent: "general_service_flow",
        source: "quick_reply",
        directCtaId: null,
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

  it("downgrades ADD_ACTOR to DIRECT_INPUT in Project SingleChat general service flow dispatch", () => {
    const result = finalizeRequirementsIntentDispatchForTest({
      userMessage: "검수자 추가해줘",
      projectId: "project-1",
      messageSendSource: "typed_text",
      intent: intent({
        suggestedActionId: "ADD_ACTOR",
        stageIntent: "service_flow",
        serviceFlowSubIntent: "general_service_flow",
        intentType: "orchestration_action",
        executionIntent: "explicit_execute",
      }),
    });

    expect(result.effectiveActionId).toBe("DIRECT_INPUT");
    expect(result.timelineDetail).toContain("[projectSingleChatBoundaryGuard]");
    expect(result.timelineDetail).toContain("project_single_chat_blocks_add_actor");
  });
});
