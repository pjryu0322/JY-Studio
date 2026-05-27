import type { ImplementationActionId, ImplementationIntentClassification } from "@/lib/prototype/implementationIntentRouterTypes";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export function buildImplementationIntentRoutedTimelineEntry(input: {
  readonly classification: ImplementationIntentClassification;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const c = input.classification;
  const now = input.nowIso ?? new Date().toISOString();
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: "implementation_intent_routed",
    source: c.routerSource === "alias" ? "platform" : c.routerSource === "rule" ? "platform" : "openai",
    routingDecision: c.targetAction ?? c.suggestedActionId ?? undefined,
    responseText: [
      "type=implementation_intent_routed",
      `source=${c.routerSource}`,
      `intentType=${c.intentType}`,
      `suggestedActionId=${c.suggestedActionId ?? "null"}`,
      `confidence=${c.confidence}`,
      `executionIntent=${c.executionIntent}`,
      `actionInvocationStrength=${c.actionInvocationStrength}`,
      `shouldExecuteAction=${c.shouldExecuteAction}`,
    ].join(" "),
    createdAt: now,
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

export function buildImplementationActionGateBlockedTimelineEntry(input: {
  readonly actionId: ImplementationActionId;
  readonly reason: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const now = input.nowIso ?? new Date().toISOString();
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: "implementation_action_gate_blocked",
    source: "platform",
    routingDecision: input.actionId,
    responseText: [
      "type=implementation_action_gate_blocked",
      `action=${input.actionId}`,
      `reason=${input.reason}`,
    ].join(" "),
    createdAt: now,
    orchestrationTraceGroup: "implementation_orchestration",
  };
}
