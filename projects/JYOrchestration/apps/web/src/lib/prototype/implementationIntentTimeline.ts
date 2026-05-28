import type {
  ImplementationActionId,
  ImplementationIntentClassification,
} from "@/lib/prototype/implementationIntentRouterTypes";
import type { ImplementationStageActionId } from "@/lib/prototype/effectiveImplementationState";
import { appendPromptTimeline } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type ImplementationStageActionTimelineSource = "cta" | "natural_language" | "system";

export type ImplementationStageActionTimelinePhase = "routed" | "executed" | "blocked";

export function buildImplementationStageActionTimelineEntry(input: {
  readonly action: ImplementationStageActionTimelinePhase;
  readonly actionId: ImplementationStageActionId;
  readonly source: ImplementationStageActionTimelineSource;
  readonly message?: string;
  readonly runId?: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const now = input.nowIso ?? new Date().toISOString();
  const actionKey =
    input.action === "routed"
      ? "implementation_stage_action_routed"
      : input.action === "executed"
        ? "implementation_stage_action_executed"
        : "implementation_stage_action_blocked";
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: actionKey,
    source: "platform",
    routingDecision: input.actionId,
    responseText: [
      "type=implementation_stage_action",
      `action=${input.action}`,
      `actionId=${input.actionId}`,
      `source=${input.source}`,
      ...(input.runId ? [`runId=${input.runId}`] : []),
      ...(input.message ? [`reason=${input.message}`] : []),
    ].join(" "),
    createdAt: now,
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

export function buildImplementationStageActionRouteTimelineEntries(input: {
  readonly actionId: ImplementationStageActionId;
  readonly source?: ImplementationStageActionTimelineSource;
  readonly nowIso?: string;
}): readonly RequirementsPromptTimelineEntry[] {
  const source = input.source ?? "cta";
  return [
    buildImplementationStageActionTimelineEntry({
      action: "routed",
      actionId: input.actionId,
      source,
      nowIso: input.nowIso,
    }),
    buildImplementationStageActionTimelineEntry({
      action: "executed",
      actionId: input.actionId,
      source,
      nowIso: input.nowIso,
    }),
  ];
}

export function buildSyntheticImplementationActionClassification(input: {
  readonly actionId: ImplementationActionId;
  readonly reason: string;
  readonly routerSource?: "platform" | "alias";
}): ImplementationIntentClassification {
  return {
    intentType: "orchestration_action",
    suggestedActionId: input.actionId,
    confidence: 1,
    reason: input.reason,
    clarificationQuestion: null,
    executionIntent: "explicit_execute",
    actionInvocationStrength: "explicit",
    extractedRules: [],
    requiresPreActionPatch: false,
    shouldExecuteAction: true,
    targetAction: input.actionId,
    routerSource: input.routerSource ?? "platform",
  };
}

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
    source: c.routerSource === "llm" ? "openai" : "platform",
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
      ...(c.reason ? [`reason=${c.reason}`] : []),
    ].join(" "),
    createdAt: now,
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

export function buildImplementationActionExecutedTimelineEntry(input: {
  readonly actionId: ImplementationActionId;
  readonly classification: ImplementationIntentClassification;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const c = input.classification;
  const now = input.nowIso ?? new Date().toISOString();
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: "implementation_action_executed",
    source: c.routerSource === "llm" ? "openai" : "platform",
    routingDecision: input.actionId,
    responseText: [
      "type=implementation_action_executed",
      `actionId=${input.actionId}`,
      `routerSource=${c.routerSource}`,
      `confidence=${c.confidence}`,
      `executionIntent=${c.executionIntent}`,
      `actionInvocationStrength=${c.actionInvocationStrength}`,
      ...(c.reason ? [`reason=${c.reason}`] : []),
    ].join(" "),
    createdAt: now,
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

export function buildImplementationActionRouteTimelineEntries(input: {
  readonly actionId: ImplementationActionId;
  readonly classification: ImplementationIntentClassification;
  readonly nowIso?: string;
}): readonly RequirementsPromptTimelineEntry[] {
  return [
    buildImplementationIntentRoutedTimelineEntry({
      classification: input.classification,
      nowIso: input.nowIso,
    }),
    buildImplementationActionExecutedTimelineEntry({
      actionId: input.actionId,
      classification: input.classification,
      nowIso: input.nowIso,
    }),
  ];
}

export function appendImplementationActionRouteTimelineEntries(input: {
  readonly promptTimeline: readonly RequirementsPromptTimelineEntry[] | undefined;
  readonly actionId: ImplementationActionId;
  readonly classification: ImplementationIntentClassification;
  readonly nowIso?: string;
}): readonly RequirementsPromptTimelineEntry[] {
  let timeline = input.promptTimeline;
  for (const entry of buildImplementationActionRouteTimelineEntries({
    actionId: input.actionId,
    classification: input.classification,
    nowIso: input.nowIso,
  })) {
    timeline = appendPromptTimeline(timeline, entry);
  }
  return timeline ?? [];
}

export function appendCreateWorkPlanBootstrapCtaRouteTimeline(input: {
  readonly promptTimeline: readonly RequirementsPromptTimelineEntry[] | undefined;
  readonly nowIso?: string;
}): readonly RequirementsPromptTimelineEntry[] {
  return appendImplementationActionRouteTimelineEntries({
    promptTimeline: input.promptTimeline,
    actionId: "CREATE_WORK_PLAN",
    classification: buildSyntheticImplementationActionClassification({
      actionId: "CREATE_WORK_PLAN",
      reason: "bootstrap_cta_clicked",
      routerSource: "platform",
    }),
    nowIso: input.nowIso,
  });
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

export function mergePromptTimelineWithBootstrapEntries(input: {
  readonly baseTimeline: readonly RequirementsPromptTimelineEntry[] | undefined;
  readonly orchestrationTimeline?: readonly RequirementsPromptTimelineEntry[] | undefined;
  readonly bootstrapTimeline?: readonly RequirementsPromptTimelineEntry[] | undefined;
}): readonly RequirementsPromptTimelineEntry[] {
  let timeline = input.baseTimeline;
  if (input.orchestrationTimeline?.length) {
    timeline = [...input.orchestrationTimeline];
  }
  for (const entry of input.bootstrapTimeline ?? []) {
    timeline = appendPromptTimeline(timeline, entry);
  }
  return timeline ?? [];
}
