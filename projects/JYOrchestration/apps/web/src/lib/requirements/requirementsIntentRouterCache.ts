/**
 * Lightweight intent routing cache — same utterance + context fingerprint reuses result.
 */

import type { IntentRoutingResult } from "@/lib/requirements/requirementsIntentRouterTypes";
import type { RequirementsIntentRouterInput } from "@/lib/requirements/requirementsIntentRouterTypes";

type CacheEntry = Readonly<{
  readonly result: IntentRoutingResult;
  readonly at: number;
}>;

const CACHE = new Map<string, CacheEntry>();
const MAX_ENTRIES = 64;
const TTL_MS = 5 * 60 * 1000;

function fingerprint(input: RequirementsIntentRouterInput): string {
  const focus = input.conversationMemory?.activeFocus;
  return [
    input.authoritativeStage,
    input.userMessage.trim().toLowerCase(),
    input.availableActionIds.join(","),
    focus ? `${focus.type}:${focus.id}` : "",
    input.conversationMemory?.clarificationPending ? "clar" : "",
    input.conversationMemory?.lastSuggestedAction ?? "",
  ].join("|");
}

export function getCachedIntentRoute(input: RequirementsIntentRouterInput): IntentRoutingResult | null {
  const key = fingerprint(input);
  const hit = CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    CACHE.delete(key);
    return null;
  }
  return { ...hit.result, reason: `${hit.result.reason ?? ""} (cached)`.trim() };
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
