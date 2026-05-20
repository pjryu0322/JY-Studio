/**
 * Requirements Intent Router — direct → clarification → cache → LLM → calibrated fallback.
 */

import { calibrateIntentConfidence } from "@/lib/requirements/requirementsIntentConfidence";
import { tryResolveClarification } from "@/lib/requirements/requirementsIntentClarification";
import { getCachedIntentRoute, setCachedIntentRoute } from "@/lib/requirements/requirementsIntentRouterCache";
import { routeRequirementsIntentDeterministic } from "@/lib/requirements/requirementsIntentRouterDeterministic";
import { routeRequirementsIntentWithLLM } from "@/lib/requirements/requirementsIntentRouterLlm";
import { getQuickActionCategory } from "@/lib/requirements/requirementsQuickActionPolicy";
import {
  resolveQuickActionIdFromLegacyLabel,
  type QuickActionId,
} from "@/lib/requirements/requirementsQuickActionRegistry";
import type {
  IntentClarificationWire,
  IntentClarificationTopic,
} from "@/lib/requirements/requirementsIntentOrchestrationWire";
import type {
  IntentRoutingResult,
  IntentRouterMode,
  IntentType,
  RequirementsIntentRouterInput,
} from "@/lib/requirements/requirementsIntentRouterTypes";
import { mapLlmFailureToRouterMode } from "@/lib/requirements/requirementsIntentRouterTypes";

export type {
  IntentRoutingResult,
  IntentRouterMode,
  IntentType,
  RequirementsIntentRouterInput,
} from "@/lib/requirements/requirementsIntentRouterTypes";

export {
  actionIdsForLlmIntentRouter,
  ARTIFACT_CHAT_SUPPRESSED_ACTION_IDS,
  isArtifactChatSuppressedActionId,
  mapLlmFailureToRouterMode,
} from "@/lib/requirements/requirementsIntentRouterTypes";

export {
  routeRequirementsIntentDeterministic,
  isLowConfidenceIntent,
} from "@/lib/requirements/requirementsIntentRouterDeterministic";

export { routeRequirementsIntentWithLLM } from "@/lib/requirements/requirementsIntentRouterLlm";

export { buildProjectionSummaryForIntentRouter } from "@/lib/requirements/requirementsIntentRouterTypes";

export type RouteRequirementsIntentOptions = Readonly<{
  readonly directQuickActionId?: QuickActionId | null;
  readonly skipLlm?: boolean;
  readonly llmCaller?: (input: RequirementsIntentRouterInput) => Promise<IntentRoutingResult | null>;
  readonly clarification?: IntentClarificationWire;
}>;

function intentTypeForDirectAction(id: QuickActionId): IntentType {
  const cat = getQuickActionCategory(id);
  if (cat === "artifact_action") return "artifact_action";
  if (cat === "view_action") return "view_action";
  if (cat === "edit_request") return "edit_request";
  return "orchestration_action";
}

function finalizeRoutedIntent(
  input: RequirementsIntentRouterInput,
  raw: IntentRoutingResult,
  extras?: Readonly<{ readonly fallbackReason?: string }>,
): IntentRoutingResult {
  const withFallback = extras?.fallbackReason
    ? { ...raw, explainability: { ...raw.explainability, fallbackReason: extras.fallbackReason } }
    : raw;
  const calibrated =
    input.conversationMemory ?
      calibrateIntentConfidence({
        raw: withFallback,
        stage: input.authoritativeStage,
        memory: input.conversationMemory,
        featureMetrics: input.featureMetrics,
      })
    : withFallback;
  if (calibrated.suggestedActionId && calibrated.routerMode !== "direct") {
    setCachedIntentRoute(input, calibrated);
  }
  return calibrated;
}

export function routeRequirementsIntentDirect(
  input: RequirementsIntentRouterInput,
  directQuickActionId: QuickActionId,
): IntentRoutingResult {
  return finalizeRoutedIntent(input, {
    intentType: intentTypeForDirectAction(directQuickActionId),
    suggestedActionId: directQuickActionId,
    confidence: 1,
    reason: "direct quick action",
    routerMode: "direct",
    explainability: { routingReason: "quick action chip" },
  });
}

/** Sync path: deterministic only (unit tests). */
export function routeRequirementsIntent(input: RequirementsIntentRouterInput): IntentRoutingResult {
  const chipId = resolveQuickActionIdFromLegacyLabel(input.userMessage);
  if (chipId && input.availableActionIds.includes(chipId)) {
    return routeRequirementsIntentDirect(input, chipId);
  }
  return finalizeRoutedIntent(input, routeRequirementsIntentDeterministic(input));
}

/** Async: direct → clarification → cache → LLM → deterministic fallback. */
export async function routeRequirementsIntentAsync(
  input: RequirementsIntentRouterInput,
  options?: RouteRequirementsIntentOptions,
): Promise<IntentRoutingResult> {
  const directId = options?.directQuickActionId ?? null;
  if (directId && input.availableActionIds.includes(directId)) {
    return routeRequirementsIntentDirect(input, directId);
  }

  const labelId = resolveQuickActionIdFromLegacyLabel(input.userMessage);
  if (labelId && input.availableActionIds.includes(labelId)) {
    return finalizeRoutedIntent(input, {
      intentType: intentTypeForDirectAction(labelId),
      suggestedActionId: labelId,
      confidence: 0.95,
      reason: "matched action label fast-path",
      routerMode: "deterministic",
    });
  }

  const clarificationWire =
    options?.clarification ??
    (input.conversationMemory?.clarificationPending ?
      {
        pending: true,
        topic: input.conversationMemory.clarificationTopic as IntentClarificationTopic,
        question: input.conversationMemory.unresolvedClarificationQuestion,
      }
    : undefined);
  if (clarificationWire?.pending) {
    const resolved = tryResolveClarification({
      userMessage: input.userMessage,
      clarification: clarificationWire,
      availableActionIds: input.availableActionIds,
    });
    if (resolved) {
      return finalizeRoutedIntent(input, {
        ...resolved,
        routerMode: "clarification_resolution",
      });
    }
  }

  const cached = getCachedIntentRoute(input);
  if (cached) return cached;

  if (!options?.skipLlm) {
    if (options?.llmCaller) {
      const fromCaller = await options.llmCaller(input);
      if (fromCaller) return finalizeRoutedIntent(input, fromCaller);
    } else {
      const llmResult = await routeRequirementsIntentWithLLM(input);
      if (llmResult.ok) return finalizeRoutedIntent(input, llmResult.intent);
      const mode = mapLlmFailureToRouterMode(llmResult.code);
      const fallback = routeRequirementsIntentDeterministic(input);
      return finalizeRoutedIntent(
        input,
        { ...fallback, routerMode: mode, reason: fallback.reason ?? llmResult.message },
        { fallbackReason: llmResult.message },
      );
    }
  }

  const fallback = routeRequirementsIntentDeterministic(input);
  return finalizeRoutedIntent(input, {
    ...fallback,
    routerMode: "fallback",
    reason: fallback.reason ?? "deterministic fallback",
  });
}

export type IntentRouterTimelineGuardSlice = Readonly<{
  readonly allowed: boolean;
  readonly reason?: string;
  readonly warning?: string;
  readonly fallbackActionIds?: readonly QuickActionId[];
}>;

export function intentRouterTimelinePayload(
  intent: IntentRoutingResult,
  guard: IntentRouterTimelineGuardSlice,
  extras?: Readonly<{
    readonly availableActionIds?: readonly QuickActionId[];
    readonly proactiveRecommendation?: string;
  }>,
): string {
  const ex = intent.explainability;
  return [
    `routerMode:${intent.routerMode}`,
    `intentType:${intent.intentType}`,
    intent.suggestedActionId ? `suggestedActionId:${intent.suggestedActionId}` : "",
    `confidence:${intent.confidence.toFixed(2)}`,
    intent.reason ? `intentReason:${intent.reason}` : "",
    ex?.routingReason ? `routingReason:${ex.routingReason}` : "",
    ex?.focusReason ? `focusReason:${ex.focusReason}` : "",
    ex?.fallbackReason ? `fallbackReason:${ex.fallbackReason}` : "",
    intent.confidenceFactors?.length ? `confidenceFactors:${intent.confidenceFactors.join(",")}` : "",
    `guardAllowed:${guard.allowed}`,
    guard.reason ? `guardReason:${guard.reason}` : "",
    guard.warning ? `guardWarning:${guard.warning}` : "",
    guard.fallbackActionIds?.length ? `fallbackActionIds:${guard.fallbackActionIds.join(",")}` : "",
    extras?.availableActionIds?.length ? `availableActionIds:${extras.availableActionIds.join(",")}` : "",
    extras?.proactiveRecommendation ? `proactiveRecommendation:${extras.proactiveRecommendation}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function isHighConfidenceIntent(result: IntentRoutingResult): boolean {
  return Boolean(result.suggestedActionId) && result.confidence >= 0.82;
}
