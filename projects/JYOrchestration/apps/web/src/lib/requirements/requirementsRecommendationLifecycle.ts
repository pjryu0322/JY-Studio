/**
 * Recommendation lifecycle — pending/accepted/dismissed/expired/obsolete with queue cleanup.
 */

import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import type { OrchestrationRecommendationWire } from "@/lib/requirements/requirementsIntentOrchestrationWire";
import { isRecommendationOnCooldown } from "@/lib/requirements/requirementsRecommendationGovernance";

export type RecommendationStatus = "pending" | "accepted" | "dismissed" | "expired" | "obsolete";

export function recommendationStatusOf(rec: OrchestrationRecommendationWire): RecommendationStatus {
  if (rec.status) return rec.status;
  if (rec.dismissed) return "dismissed";
  if (rec.accepted) return "accepted";
  if (rec.rejected) return "expired";
  return rec.disposition === "accepted" ? "accepted" : rec.disposition === "dismissed" ? "dismissed" : "pending";
}

export function withRecommendationStatus(
  rec: OrchestrationRecommendationWire,
  status: RecommendationStatus,
): OrchestrationRecommendationWire {
  return {
    ...rec,
    status,
    disposition: status === "accepted" ? "accepted" : status === "dismissed" ? "dismissed" : "pending",
    ...(status === "dismissed" ? { dismissed: true } : {}),
    ...(status === "accepted" ? { accepted: true } : {}),
  };
}

export function markRecommendationsObsolete(input: {
  readonly queue: readonly OrchestrationRecommendationWire[];
  readonly stage: OrchestrationStage;
  readonly previousStage?: OrchestrationStage;
  readonly focusTargetKey?: string;
  readonly previousFocusTargetKey?: string;
  readonly sourceStale?: boolean;
  readonly nowIso?: string;
}): readonly OrchestrationRecommendationWire[] {
  const stageChanged = Boolean(input.previousStage && input.previousStage !== input.stage);
  const targetChanged = Boolean(
    input.previousFocusTargetKey &&
      input.focusTargetKey &&
      input.previousFocusTargetKey !== input.focusTargetKey,
  );

  return input.queue
    .map((rec) => {
      const targetMismatch =
        input.focusTargetKey && rec.targetKey && rec.targetKey !== input.focusTargetKey;
      if (stageChanged || targetChanged || targetMismatch || input.sourceStale) {
        const status = recommendationStatusOf(rec);
        if (status === "accepted") return rec;
        return withRecommendationStatus(rec, "obsolete");
      }
      return rec;
    })
    .filter((rec) => {
      const status = recommendationStatusOf(rec);
      if (status === "obsolete" || status === "expired") return false;
      if (status === "dismissed") {
        return !isRecommendationOnCooldown(rec, input.nowIso ? Date.parse(input.nowIso) : Date.now());
      }
      return rec.score > -100;
    });
}
