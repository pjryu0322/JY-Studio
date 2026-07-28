/**
 * P2 admin workflow — pure gate functions.
 *
 * Every function here is a pure predicate/reducer over already-loaded
 * phase markers. No DB/IO. Keep this the single source of truth for
 * "can the admin move to step X" decisions so UI and API routes agree.
 */
import type {
  AdminProviderReviewPhase,
  AdminPublishGatePhase,
  AdminQualityGateSnapshot,
  AdminServiceValidationPhase,
  AdminWorkerZipPhase,
} from "./admin-workflow-state";

/** Open admin-facing supplement phases block service validation / provider re-request. */
const OPEN_ADMIN_SUPPLEMENT_PHASES = ["PENDING", "ACCEPTED", "CLARIFY", "RESOLVED"] as const;

export function isOpenAdminSupplementPhase(phase: string | null | undefined): boolean {
  return (OPEN_ADMIN_SUPPLEMENT_PHASES as readonly string[]).includes(phase ?? "");
}

const RECEIPT_DONE_ENOUGH_PHASES = ["ACCEPTED", "PROCESSING", "COMPLETED", "FAILED"] as const;

/** RECEIPT → SCOPE once the worker zip has been accepted (or moved past acceptance). */
export function canEnterKnowledgeScope(input: { workerZipPhase: AdminWorkerZipPhase }): boolean {
  return (RECEIPT_DONE_ENOUGH_PHASES as readonly AdminWorkerZipPhase[]).includes(input.workerZipPhase);
}

/**
 * P2 skeleton: knowledge scope confirmation is not yet a hard gate — once the
 * worker zip is accepted (or later), generation may be entered.
 */
export function canEnterGeneration(input: {
  workerZipPhase: AdminWorkerZipPhase;
  knowledgeScopeConfirmed?: boolean;
}): boolean {
  return (RECEIPT_DONE_ENOUGH_PHASES as readonly AdminWorkerZipPhase[]).includes(input.workerZipPhase);
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
