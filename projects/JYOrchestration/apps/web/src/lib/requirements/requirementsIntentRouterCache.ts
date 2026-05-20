/**
 * Lightweight intent routing cache — same utterance + context fingerprint reuses result.
 */

import { INTENT_ROUTER_CACHE_SCHEMA_VERSION } from "@/lib/requirements/requirementsOrchestrationConstants";
import type { IntentRoutingResult } from "@/lib/requirements/requirementsIntentRouterTypes";
import type { RequirementsIntentRouterInput } from "@/lib/requirements/requirementsIntentRouterTypes";

type CacheEntry = Readonly<{
  readonly result: IntentRoutingResult;
  readonly at: number;
}>;

const CACHE = new Map<string, CacheEntry>();
const MAX_ENTRIES = 64;
const TTL_MS = 5 * 60 * 1000;

function featureMetricsSummary(input: RequirementsIntentRouterInput): string {
  const m = input.featureMetrics;
  return [
    m.confirmedFeatureCount,
    m.featureCoverage.toFixed(2),
    m.hasConfirmedFeature ? "1" : "0",
  ].join(":");
}

function projectionHash(input: RequirementsIntentRouterInput): string {
  return [
    input.authoritativeStage,
    input.availableActionIds.join(","),
    input.chatVisibleActionIds.join(","),
    input.projection.conversationState,
    featureMetricsSummary(input),
    input.conversationMemory?.clarificationPending ? "clar" : "",
    input.artifactHubState?.badgeEligible ? "hub1" : "hub0",
    INTENT_ROUTER_CACHE_SCHEMA_VERSION,
  ].join(":");
}

function fingerprint(input: RequirementsIntentRouterInput): string {
  const focus = input.activeFocus ?? input.conversationMemory?.activeFocus;
  const session = input.conversationMemory?.recentTransitions?.[0] ?? "";
  return [
    `v${INTENT_ROUTER_CACHE_SCHEMA_VERSION}`,
    projectionHash(input),
    input.userMessage.trim().toLowerCase(),
    focus ? `${focus.type}:${focus.id}:${focus.softStale ? "stale" : "fresh"}` : "",
    input.conversationMemory?.lastSuggestedAction ?? "",
    session.slice(0, 40),
  ].join("|");
}

/** @internal tests */
export function intentRouterCacheFingerprint(input: RequirementsIntentRouterInput): string {
  return fingerprint(input);
}

/** @internal tests */
export function intentRouterCacheProjectionHash(input: RequirementsIntentRouterInput): string {
  return projectionHash(input);
}

export function getCachedIntentRoute(input: RequirementsIntentRouterInput): IntentRoutingResult | null {
  const key = fingerprint(input);
  const hit = CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    CACHE.delete(key);
    return null;
  }
  return {
    ...hit.result,
    routerMode: "cache",
    reason: `${hit.result.reason ?? ""} (cached)`.trim(),
    explainability: {
      ...hit.result.explainability,
      routingReason: hit.result.explainability?.routingReason ?? "intent router cache hit",
    },
  };
}

export function setCachedIntentRoute(input: RequirementsIntentRouterInput, result: IntentRoutingResult): void {
  const key = fingerprint(input);
  if (CACHE.size >= MAX_ENTRIES) {
    const oldest = CACHE.keys().next().value;
    if (oldest) CACHE.delete(oldest);
  }
  CACHE.set(key, { result, at: Date.now() });
}

export function clearIntentRouterCache(): void {
  CACHE.clear();
}

/** @internal tests */
export function intentRouterCacheSize(): number {
  return CACHE.size;
}
