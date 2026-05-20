/**
 * Requirements Intent Router — direct fast-path → LLM → deterministic fallback.
 * Does NOT execute transitions; Registry Guard + dispatcher own execution.
 */

import { routeRequirementsIntentDeterministic } from "@/lib/requirements/requirementsIntentRouterDeterministic";
import { routeRequirementsIntentWithLLM } from "@/lib/requirements/requirementsIntentRouterLlm";
import {
  getQuickActionCategory,
} from "@/lib/requirements/requirementsQuickActionPolicy";
import {
  resolveQuickActionIdFromLegacyLabel,
  type QuickActionId,
} from "@/lib/requirements/requirementsQuickActionRegistry";
import type {
  IntentRoutingResult,
  IntentRouterMode,
  IntentType,
  RequirementsIntentRouterInput,
} from "@/lib/requirements/requirementsIntentRouterTypes";

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
}>;

function intentTypeForDirectAction(id: QuickActionId): IntentType {
  const cat = getQuickActionCategory(id);
  if (cat === "artifact_action") return "artifact_action";
  if (cat === "view_action") return "view_action";
  if (cat === "edit_request") return "edit_request";
  return "orchestration_action";
}

export function routeRequirementsIntentDirect(
  input: RequirementsIntentRouterInput,
  directQuickActionId: QuickActionId,
): IntentRoutingResult {
  return {
    intentType: intentTypeForDirectAction(directQuickActionId),
    suggestedActionId: directQuickActionId,
    confidence: 1,
    reason: "direct quick action",
    routerMode: "direct",
  };
}

/** Sync path: deterministic only (tests / fallback). */
export function routeRequirementsIntent(input: RequirementsIntentRouterInput): IntentRoutingResult {
  const chipId = resolveQuickActionIdFromLegacyLabel(input.userMessage);
  if (chipId && input.availableActionIds.includes(chipId)) {
    return {
      intentType: intentTypeForDirectAction(chipId),
      suggestedActionId: chipId,
      confidence: 0.95,
      reason: "matched quick action label",
      routerMode: "deterministic",
    };
  }
  return routeRequirementsIntentDeterministic(input);
}

/** Async: direct → LLM → deterministic fallback. */
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
    return {
      intentType: intentTypeForDirectAction(labelId),
      suggestedActionId: labelId,
      confidence: 0.95,
      reason: "matched action label fast-path",
      routerMode: "deterministic",
    };
  }

  if (!options?.skipLlm) {
    const llm =
      options?.llmCaller ?
        await options.llmCaller(input)
      : await (async () => {
          const res = await routeRequirementsIntentWithLLM(input);
          return res.ok ? res.intent : null;
        })();
    if (llm) return llm;
  }

  const fallback = routeRequirementsIntentDeterministic(input);
  return { ...fallback, routerMode: "fallback" as IntentRouterMode, reason: fallback.reason ?? "deterministic fallback" };
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
  }>,
): string {
  return [
    `routerMode:${intent.routerMode}`,
    `intentType:${intent.intentType}`,
    intent.suggestedActionId ? `suggestedActionId:${intent.suggestedActionId}` : "",
    `confidence:${intent.confidence.toFixed(2)}`,
    intent.reason ? `intentReason:${intent.reason}` : "",
    `guardAllowed:${guard.allowed}`,
    guard.reason ? `guardReason:${guard.reason}` : "",
    guard.warning ? `guardWarning:${guard.warning}` : "",
    guard.fallbackActionIds?.length ? `fallbackActionIds:${guard.fallbackActionIds.join(",")}` : "",
    extras?.availableActionIds?.length ? `availableActionIds:${extras.availableActionIds.join(",")}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function isHighConfidenceIntent(result: IntentRoutingResult): boolean {
  return Boolean(result.suggestedActionId) && result.confidence >= 0.82;
}
