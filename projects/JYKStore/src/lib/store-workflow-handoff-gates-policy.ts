/**
 * Pure Store handoff gate policy — safe for client + server.
 */

import type { AdminWorkerZipPhase } from "@/lib/role-workspace/admin-review-rail";
import type { AdminQualityGateSnapshot } from "@/lib/role-workspace/admin-review-rail";
import { isOpenProviderSupplementPhase } from "@/lib/provider-supplement-request";

export function isWorkerKnowledgeGenerationCompleted(
  workerZipPhase: AdminWorkerZipPhase | string | null | undefined,
): boolean {
  return workerZipPhase === "COMPLETED";
}

/** True when admin may request provider generation-result review. */
export function canRequestProviderReviewHandoff(input: {
  workerZipPhase: AdminWorkerZipPhase | string | null | undefined;
  quality: AdminQualityGateSnapshot;
  providerReviewPhase?: string | null;
  /** Open supplement must go through REQUEST_PROVIDER_REVIEW_AGAIN, not this gate. */
  providerSupplementPhase?: string | null;
}): boolean {
  if (input.providerReviewPhase === "REQUESTED" || input.providerReviewPhase === "CONFIRMED") {
    return false;
  }
  if (isOpenProviderSupplementPhase(input.providerSupplementPhase)) {
    return false;
  }
  if (!isWorkerKnowledgeGenerationCompleted(input.workerZipPhase)) return false;
  if (!input.quality.completed) return false;
  if (input.quality.hasBlockers || input.quality.failCount > 0) return false;
  return true;
}
