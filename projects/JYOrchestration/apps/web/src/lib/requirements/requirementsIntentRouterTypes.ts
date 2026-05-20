/**
 * Intent Router shared types — LLM / deterministic / dispatch.
 */

import type { FeatureDetailProjectionMetrics } from "@/lib/requirements/featureDetailSlots";
import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import type { RequirementsOrchestrationProjection } from "@/lib/requirements/requirementsOrchestrationProjection";
import type { QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";

export type IntentType =
  | "orchestration_action"
  | "artifact_action"
  | "view_action"
  | "edit_request"
  | "question"
  | "unknown";

export type IntentRouterMode = "direct" | "deterministic" | "llm" | "fallback";

export type IntentRoutingResult = Readonly<{
  readonly intentType: IntentType;
  readonly suggestedActionId: QuickActionId | null;
  readonly confidence: number;
  readonly reason?: string;
  readonly clarificationQuestion?: string;
  readonly routerMode: IntentRouterMode;
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

/** LLM may only pick from these ids (artifact doc actions excluded). */
export function actionIdsForLlmIntentRouter(available: readonly QuickActionId[]): readonly QuickActionId[] {
  return available.filter((id) => !isArtifactChatSuppressedActionId(id));
}

export function buildProjectionSummaryForIntentRouter(input: RequirementsIntentRouterInput): string {
  const m = input.featureMetrics;
  return [
    `stage=${input.authoritativeStage}`,
    `conv=${input.projection.conversationState ?? "none"}`,
    `features=${m.featureCount} confirmed=${m.confirmedFeatureCount} partial=${m.partialFeatureCount} candidate=${m.candidateFeatureCount}`,
    `coverage=${Math.round(m.featureCoverage * 100)}%`,
    `allowedActions=${input.availableActionIds.join(",")}`,
    `chatVisible=${input.chatVisibleActionIds.join(",")}`,
  ].join("; ");
}
