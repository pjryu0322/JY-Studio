/**
 * Pure Store handoff gate policy — safe for client + server.
 *
 * P2: Provider review handoff is only allowed AFTER service validation passes.
 * Quality/generation completion alone is not enough.
 */

import type { AdminQualityGateSnapshot, AdminWorkerZipPhase } from "@/lib/workflow";
import { canRequestProviderReviewAfterServiceValidation } from "@/lib/workflow";
import { isOpenProviderSupplementPhase } from "@/lib/provider-supplement-request";
import type { AdminProviderReviewPhase, AdminServiceValidationPhase } from "@/lib/workflow";

export function isWorkerKnowledgeGenerationCompleted(
  workerZipPhase: AdminWorkerZipPhase | string | null | undefined,
): boolean {
  return workerZipPhase === "COMPLETED";
}

function asProviderPhase(raw: string | null | undefined): AdminProviderReviewPhase {
  if (raw === "REQUESTED" || raw === "CONFIRMED" || raw === "WITHDRAWN") return raw;
  return "NONE";
}

function asServicePhase(raw: string | null | undefined): AdminServiceValidationPhase {
  return raw === "PASSED" ? "PASSED" : "NONE";
}

function asWorkerPhase(raw: string | null | undefined): AdminWorkerZipPhase {
  if (
    raw === "NONE" ||
    raw === "REQUESTED" ||
    raw === "ACCEPTED" ||
    raw === "REJECTED" ||
    raw === "PROCESSING" ||
    raw === "COMPLETED" ||
    raw === "FAILED"
  ) {
    return raw;
  }
  return "NONE";
}

/**
 * True when admin may request provider review of service results.
 * Requires SERVICE_VALIDATION PASSED (P2 order).
 */
export function canRequestProviderReviewHandoff(input: {
  workerZipPhase: AdminWorkerZipPhase | string | null | undefined;
  quality: AdminQualityGateSnapshot;
  providerReviewPhase?: string | null;
  providerSupplementPhase?: string | null;
  /** Required for P2 — provider review follows service validation. */
  serviceValidationPhase?: string | null;
}): boolean {
  if (isOpenProviderSupplementPhase(input.providerSupplementPhase)) {
    return false;
  }
  return canRequestProviderReviewAfterServiceValidation({
    serviceValidationPhase: asServicePhase(input.serviceValidationPhase),
    providerReviewPhase: asProviderPhase(input.providerReviewPhase),
    openSupplement: false,
    workerZipPhase: asWorkerPhase(input.workerZipPhase),
    quality: input.quality,
  });
}
