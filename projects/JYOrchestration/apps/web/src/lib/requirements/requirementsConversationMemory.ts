/**
 * Compressed orchestration memory for intent routing (not full chat transcript).
 */

import type { FeatureDetailProjectionMetrics } from "@/lib/requirements/featureDetailSlots";
import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import type { QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { resolveAuthoritativeOrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import { projectFeatureDetailMetrics } from "@/lib/requirements/featureDetailSlots";
import { resolveActiveFocus, type ConversationFocusContext } from "@/lib/requirements/requirementsConversationFocus";
import type { RequirementsIntentOrchestrationV1 } from "@/lib/requirements/requirementsIntentOrchestrationWire";

export type OrchestrationConversationMemory = Readonly<{
  readonly recentConversationSummary: string;
  readonly activeFocus: ReturnType<typeof resolveActiveFocus>;
  readonly currentEditingTarget: RequirementsIntentOrchestrationV1["currentEditingTarget"];
  readonly lastSuggestedAction: QuickActionId | null;
  readonly lastConfirmedAction: QuickActionId | null;
  readonly clarificationPending: boolean;
  readonly clarificationTopic?: string;
  readonly unresolvedClarificationQuestion?: string;
  readonly orchestrationWarnings: readonly string[];
  readonly recentTransitions: readonly string[];
}>;

export function compressRecentMessagesForMemory(
  lines: readonly { readonly role: "user" | "ai"; readonly body: string }[],
  maxLines = 6,
): string {
  const slice = lines.slice(-maxLines);
  return slice
    .map((l) => `${l.role === "user" ? "U" : "A"}: ${String(l.body ?? "").trim().replace(/\s+/g, " ").slice(0, 160)}`)
    .join(" | ");
}

export function buildOrchestrationConversationMemory(input: {
  readonly state: RequirementsStateJson;
  readonly recentMessageLines?: readonly { readonly role: "user" | "ai"; readonly body: string }[];
  readonly orchestration?: RequirementsIntentOrchestrationV1 | null | undefined;
}): OrchestrationConversationMemory {
  const stage = resolveAuthoritativeOrchestrationStage(input.state);
  const metrics = projectFeatureDetailMetrics(input.state.featureDetailSlotsV1);
  const orch = input.orchestration ?? input.state.requirementsIntentOrchestrationV1 ?? null;
  const focusCtx: ConversationFocusContext = {
    orchestration: orch,
    featureDetailSlotsV1: input.state.featureDetailSlotsV1,
    serviceFlowV1: input.state.serviceFlowV1,
  };
  const activeFocus = resolveActiveFocus(focusCtx);
  const warnings: string[] = [];
  if (!metrics.hasConfirmedFeature && (stage === "FEATURE_DETAIL" || stage === "SCREEN_DEFINE")) {
    warnings.push("no_confirmed_features");
  }
  if (metrics.featureCoverage > 0 && metrics.featureCoverage < 0.7) {
    warnings.push("low_feature_coverage");
  }
  if (orch?.clarification?.pending) warnings.push("clarification_pending");

  const summaryParts = [
    `stage=${stage}`,
    activeFocus ? `focus=${activeFocus.type}:${activeFocus.label ?? activeFocus.id}` : "",
    orch?.lastConfirmedActionId ? `lastConfirmed=${orch.lastConfirmedActionId}` : "",
    orch?.lastSuggestedActionId ? `lastSuggested=${orch.lastSuggestedActionId}` : "",
    compressRecentMessagesForMemory(input.recentMessageLines ?? []),
  ].filter(Boolean);

  return {
    recentConversationSummary: (orch?.recentConversationSummary ?? summaryParts.join("; ")).slice(0, 2000),
    activeFocus,
    currentEditingTarget: orch?.currentEditingTarget,
    lastSuggestedAction: orch?.lastSuggestedActionId ?? null,
    lastConfirmedAction: orch?.lastConfirmedActionId ?? null,
    clarificationPending: orch?.clarification?.pending === true,
    clarificationTopic: orch?.clarification?.topic,
    unresolvedClarificationQuestion: orch?.clarification?.pending ? orch.clarification.question : undefined,
    orchestrationWarnings: warnings,
    recentTransitions: orch?.lastRouting?.routerMode ? [`lastRoute:${orch.lastRouting.routerMode}`] : [],
  };
}

export function memorySummaryForRouterPayload(memory: OrchestrationConversationMemory): Record<string, unknown> {
  return {
    recentConversationSummary: memory.recentConversationSummary,
    activeFocus: memory.activeFocus,
    currentEditingTarget: memory.currentEditingTarget,
    lastSuggestedAction: memory.lastSuggestedAction,
    lastConfirmedAction: memory.lastConfirmedAction,
    clarificationPending: memory.clarificationPending,
    clarificationTopic: memory.clarificationTopic,
    unresolvedClarificationQuestion: memory.unresolvedClarificationQuestion,
    orchestrationWarnings: memory.orchestrationWarnings,
    recentTransitions: memory.recentTransitions,
  };
}
