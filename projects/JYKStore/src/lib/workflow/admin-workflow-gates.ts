/**
 * P2 admin workflow — pure gate functions.
 *
 * Every function here is a pure predicate/reducer over already-loaded
 * phase markers. No DB/IO. Keep this the single source of truth for
 * "can the admin move to step X" decisions so UI and API routes agree.
 */
import { isOpenProviderSupplementPhase } from "@/lib/provider-supplement-request";
import type {
  AdminProviderReviewPhase,
  AdminPublishGatePhase,
  AdminQualityGateSnapshot,
  AdminServiceValidationPhase,
  AdminWorkerZipPhase,
} from "./admin-workflow-state";

/** Alias of provider open-supplement SoT — keep name for admin workflow call sites. */
export const isOpenAdminSupplementPhase = isOpenProviderSupplementPhase;

const RECEIPT_DONE_ENOUGH_PHASES = ["ACCEPTED", "PROCESSING", "COMPLETED", "FAILED"] as const;

/** RECEIPT → SCOPE once the worker zip has been accepted (or moved past acceptance). */
export function canEnterKnowledgeScope(input: { workerZipPhase: AdminWorkerZipPhase }): boolean {
  return (RECEIPT_DONE_ENOUGH_PHASES as readonly AdminWorkerZipPhase[]).includes(input.workerZipPhase);
}

export function canEnterGeneration(input: {
  workerZipPhase: AdminWorkerZipPhase;
  /** @deprecated Use knowledgeScopeReady with canEnterGenerationWithScope. */
  knowledgeScopeConfirmed?: boolean;
}): boolean {
  return (RECEIPT_DONE_ENOUGH_PHASES as readonly AdminWorkerZipPhase[]).includes(input.workerZipPhase);
}

/** Generation step gate when knowledge-scope inventory readiness is known. */
export function canEnterGenerationWithScope(input: {
  workerZipPhase: AdminWorkerZipPhase;
  knowledgeScopeReady?: boolean;
}): boolean {
  if (!(RECEIPT_DONE_ENOUGH_PHASES as readonly AdminWorkerZipPhase[]).includes(input.workerZipPhase)) {
    return false;
  }
  if (input.knowledgeScopeReady === undefined) {
    return true;
  }
  return input.knowledgeScopeReady === true;
}

/** Generation completed with blockers/failures or open supplement — Correction is the work location.
 * Warnings alone do NOT force Correction (P2 policy): they remain eligible for Service Validation.
 */
export function canEnterCorrection(input: {
  workerZipPhase: AdminWorkerZipPhase;
  quality: AdminQualityGateSnapshot;
  openSupplement?: boolean;
}): boolean {
  if (input.workerZipPhase !== "COMPLETED") return false;
  return (
    input.quality.hasBlockers ||
    input.quality.failCount > 0 ||
    Boolean(input.openSupplement)
  );
}

/**
 * Generation completed cleanly with no blockers/failures/open-supplements.
 * NOTE: does NOT require provider review — provider review is a publish gate.
 */
export function canEnterServiceValidation(input: {
  workerZipPhase: AdminWorkerZipPhase;
  quality: AdminQualityGateSnapshot;
  openSupplement?: boolean;
}): boolean {
  return (
    input.workerZipPhase === "COMPLETED" &&
    input.quality.completed &&
    !input.quality.hasBlockers &&
    input.quality.failCount === 0 &&
    !input.openSupplement
  );
}

/** Service validation passed and there's nothing outstanding blocking a provider-review request. */
export function canRequestProviderReviewAfterServiceValidation(input: {
  serviceValidationPhase: AdminServiceValidationPhase;
  providerReviewPhase: AdminProviderReviewPhase;
  openSupplement?: boolean;
  workerZipPhase: AdminWorkerZipPhase;
  quality: AdminQualityGateSnapshot;
}): boolean {
  return (
    input.serviceValidationPhase === "PASSED" &&
    !input.openSupplement &&
    input.providerReviewPhase !== "REQUESTED" &&
    input.providerReviewPhase !== "CONFIRMED" &&
    input.workerZipPhase === "COMPLETED" &&
    input.quality.completed &&
    !input.quality.hasBlockers &&
    input.quality.failCount === 0
  );
}

/** Publish requires service validation PASSED and provider CONFIRMED, with no open supplement. */
export function canPublish(input: {
  serviceValidationPhase: AdminServiceValidationPhase;
  providerReviewPhase: AdminProviderReviewPhase;
  openSupplement?: boolean;
  packStatus?: string | null;
}): boolean {
  return (
    input.serviceValidationPhase === "PASSED" &&
    input.providerReviewPhase === "CONFIRMED" &&
    !input.openSupplement
  );
}

export function resolveAdminPublishGatePhase(input: {
  serviceValidationPhase: AdminServiceValidationPhase;
  providerReviewPhase: AdminProviderReviewPhase;
  openSupplement?: boolean;
  workerZipPhase: AdminWorkerZipPhase;
  quality: AdminQualityGateSnapshot;
  packStatus?: string | null;
}): AdminPublishGatePhase {
  if (input.packStatus === "PUBLISHED" || input.packStatus === "VERIFIED") {
    return "PUBLISHED";
  }
  if (canPublish(input)) {
    return "READY_TO_PUBLISH";
  }
  if (input.providerReviewPhase === "CONFIRMED") {
    return "PROVIDER_APPROVED";
  }
  if (input.providerReviewPhase === "REQUESTED") {
    return "PROVIDER_REVIEW_REQUESTED";
  }
  if (canRequestProviderReviewAfterServiceValidation(input)) {
    return "READY_FOR_PROVIDER_REVIEW";
  }
  if (input.serviceValidationPhase !== "PASSED") {
    return "AWAITING_SERVICE_VALIDATION";
  }
  return "NOT_READY";
}
