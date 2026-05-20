/**
 * Intent Router shared types — LLM / deterministic / dispatch / phase-2 continuity.
 */

import type { FeatureDetailProjectionMetrics } from "@/lib/requirements/featureDetailSlots";
import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import type { RequirementsOrchestrationProjection } from "@/lib/requirements/requirementsOrchestrationProjection";
import type { QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";
import type { FeatureDetailSlotsV1 } from "@/lib/requirements/featureDetailSlots";
import type { ArtifactHubOrchestrationState } from "@/lib/requirements/requirementsArtifactHubOrchestration";
import type { OrchestrationConversationMemory } from "@/lib/requirements/requirementsConversationMemory";
import type { ConversationFocusWire } from "@/lib/requirements/requirementsIntentOrchestrationWire";

export type IntentType =
  | "orchestration_action"
  | "artifact_action"
  | "view_action"
  | "edit_request"
  | "question"
  | "unknown";

export type IntentRouterMode =
  | "direct"
  | "deterministic"
  | "llm"
  | "fallback"
  | "timeout_fallback"
  | "invalid_json_fallback"
  | "rate_limit_fallback"
  | "clarification_resolution";

export type IntentRoutingExplainability = Readonly<{
  readonly routingReason?: string;
  readonly guardReason?: string;
  readonly fallbackReason?: string;
  readonly focusReason?: string;
  readonly confidenceFactors?: readonly string[];
}>;

export type IntentRoutingResult = Readonly<{
  readonly intentType: IntentType;
  readonly suggestedActionId: QuickActionId | null;
  readonly confidence: number;
  readonly reason?: string;
  readonly clarificationQuestion?: string;
  readonly routerMode: IntentRouterMode;
  readonly confidenceFactors?: readonly string[];
  readonly explainability?: IntentRoutingExplainability;
  readonly extractedTargets?: Readonly<{
    readonly featureIds?: readonly string[];
    readonly stepIds?: readonly string[];
    readonly actorIds?: readonly string[];
  }>;
}>;

export type RequirementsIntentRouterInput = Readonly<{
  readonly userMessage: string;
  readonly authoritativeStage: OrchestrationStage;
  readonly availableActionIds: readonly QuickActionId[];
  readonly chatVisibleActionIds: readonly QuickActionId[];
  readonly projection: Pick<
    RequirementsOrchestrationProjection,
    "authoritativeStage" | "quickActions" | "featureDetail" | "conversationState"
  >;
  readonly featureMetrics: FeatureDetailProjectionMetrics;
  readonly projectName?: string;
  readonly projectDescription?: string;
  readonly conversationMemory?: OrchestrationConversationMemory;
  readonly activeFocus?: ConversationFocusWire | null;
  readonly artifactHubState?: ArtifactHubOrchestrationState;
  readonly featureDetailSlotsV1?: FeatureDetailSlotsV1 | null;
}>;

export const ARTIFACT_CHAT_SUPPRESSED_ACTION_IDS = [
  "GENERATE_DOCUMENT",
  "EXPORT_MARKDOWN",
  "EXPORT_PDF",
] as const satisfies readonly QuickActionId[];

export type ArtifactChatSuppressedActionId = (typeof ARTIFACT_CHAT_SUPPRESSED_ACTION_IDS)[number];

export function isArtifactChatSuppressedActionId(id: QuickActionId): id is ArtifactChatSuppressedActionId {
  return (ARTIFACT_CHAT_SUPPRESSED_ACTION_IDS as readonly string[]).includes(id);
}

export function actionIdsForLlmIntentRouter(available: readonly QuickActionId[]): readonly QuickActionId[] {
  return available.filter((id) => !isArtifactChatSuppressedActionId(id));
}

export function buildProjectionSummaryForIntentRouter(input: RequirementsIntentRouterInput): string {
  const m = input.featureMetrics;
  const mem = input.conversationMemory;
  return [
    `stage=${input.authoritativeStage}`,
    `conv=${input.projection.conversationState ?? "none"}`,
    `features=${m.featureCount} confirmed=${m.confirmedFeatureCount} partial=${m.partialFeatureCount} candidate=${m.candidateFeatureCount}`,
    `coverage=${Math.round(m.featureCoverage * 100)}%`,
    `allowedActions=${input.availableActionIds.join(",")}`,
    `chatVisible=${input.chatVisibleActionIds.join(",")}`,
    mem?.activeFocus ? `focus=${mem.activeFocus.type}:${mem.activeFocus.id}` : "",
    mem?.lastSuggestedAction ? `lastSuggested=${mem.lastSuggestedAction}` : "",
    mem?.clarificationPending ? "clarificationPending=true" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function mapLlmFailureToRouterMode(code: string): IntentRouterMode {
  const c = String(code ?? "").toUpperCase();
  if (c.includes("TIMEOUT") || c === "NETWORK") return "timeout_fallback";
  if (c.includes("429") || c.includes("RATE")) return "rate_limit_fallback";
  if (c === "PARSE" || c.includes("JSON")) return "invalid_json_fallback";
  return "fallback";
}
