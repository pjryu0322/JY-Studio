/**
 * Recommendation dedupe, cooldown, dismiss/accept/reject governance.
 */

import type { QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";
import { RECOMMENDATION_COOLDOWN_MS } from "@/lib/requirements/requirementsOrchestrationConstants";
import type { OrchestrationRecommendationWire } from "@/lib/requirements/requirementsIntentOrchestrationWire";
import { withRecommendationStatus } from "@/lib/requirements/requirementsRecommendationLifecycle";

export type RecommendationDisposition = "pending" | "dismissed" | "accepted" | "rejected";

export function recommendationTargetKey(actionId: QuickActionId, targetId?: string): string {
  return `${actionId}:${targetId ?? "*"}`;
}

export function isRecommendationOnCooldown(
  rec: OrchestrationRecommendationWire,
  nowMs: number = Date.now(),
): boolean {
  if (rec.dismissed) return true;
  if (rec.cooldownUntil) {
    const until = Date.parse(rec.cooldownUntil);
    if (Number.isFinite(until) && nowMs < until) return true;
  }
  return false;
}

export function mergeGovernedRecommendations(input: {
  readonly incoming: readonly OrchestrationRecommendationWire[];
  readonly previous?: readonly OrchestrationRecommendationWire[];
  readonly nowIso?: string;
  readonly cooldownMs?: number;
}): readonly OrchestrationRecommendationWire[] {
  const nowMs = input.nowIso ? Date.parse(input.nowIso) : Date.now();
  const cooldownMs = input.cooldownMs ?? RECOMMENDATION_COOLDOWN_MS;
  const byKey = new Map<string, OrchestrationRecommendationWire>();

  for (const prev of input.previous ?? []) {
    const key = recommendationTargetKey(prev.actionId, prev.targetKey);
    byKey.set(key, prev);
  }

  for (const raw of input.incoming) {
    const targetKey = raw.targetKey ?? recommendationTargetKey(raw.actionId).split(":")[1];
    const key = recommendationTargetKey(raw.actionId, targetKey);
    const prev = byKey.get(key);
    if (prev && isRecommendationOnCooldown(prev, nowMs)) continue;

    const merged: OrchestrationRecommendationWire = {
      actionId: raw.actionId,
      score: Math.max(raw.score, prev?.score ?? 0),
      reason: raw.reason,
      blocking: raw.blocking,
      generatedAt: raw.generatedAt,
      targetKey,
      disposition: prev?.disposition === "accepted" ? "accepted" : "pending",
      ...(prev?.dismissed ? { dismissed: true, cooldownUntil: prev.cooldownUntil } : {}),
      ...(prev?.accepted ? { accepted: true } : {}),
      ...(prev?.rejected ? { rejected: true } : {}),
    };

    const scored =
      prev && prev.reason === raw.reason && prev.actionId === raw.actionId
        ? { ...merged, score: Math.max(prev.score, raw.score) }
        : merged;

    byKey.set(key, withRecommendationStatus(scored, scored.dismissed ? "dismissed" : "pending"));
  }

  return [...byKey.values()]
    .filter((r) => !isRecommendationOnCooldown(r, nowMs) && r.score > -100)
    .sort((a, b) => b.score - a.score);
}

export function dismissRecommendation(
  rec: OrchestrationRecommendationWire,
  nowIso?: string,
): OrchestrationRecommendationWire {
  const now = nowIso ?? new Date().toISOString();
  const until = new Date(Date.parse(now) + RECOMMENDATION_COOLDOWN_MS).toISOString();
  return {
    ...rec,
    dismissed: true,
    disposition: "dismissed",
    cooldownUntil: until,
  };
}
