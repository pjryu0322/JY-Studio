/**
 * Pure Store handoff gate policy — safe for client + server.
 */

import type { AdminWorkerZipPhase } from "@/lib/role-workspace/admin-review-rail";
import type { AdminQualityGateSnapshot } from "@/lib/role-workspace/admin-review-rail";

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
}): boolean {
  if (input.providerReviewPhase === "REQUESTED" || input.providerReviewPhase === "CONFIRMED") {
    return false;
  }
  if (!isWorkerKnowledgeGenerationCompleted(input.workerZipPhase)) return false;
  if (!input.quality.completed) return false;
  if (input.quality.hasBlockers || input.quality.failCount > 0) return false;
  return true;
}
