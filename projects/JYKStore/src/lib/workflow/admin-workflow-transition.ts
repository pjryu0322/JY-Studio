/**
 * P2 admin workflow — current-step resolution.
 *
 * Given the raw phase markers for a pack, resolve which of the six
 * canonical {@link AdminWorkflowStep} values the admin should currently be
 * looking at. Pure function, no DB/IO — keep UI and API routes derived from
 * this single source of truth.
 */
import { isOpenAdminSupplementPhase } from "./admin-workflow-gates";
import type {
  AdminProviderReviewPhase,
  AdminQualityGateSnapshot,
  AdminServiceValidationPhase,
  AdminWorkerZipPhase,
} from "./admin-workflow-state";
import type { AdminWorkflowStep } from "./admin-workflow-steps";

export function resolveAdminWorkflowCurrentStep(input: {
  workerZipPhase: AdminWorkerZipPhase;
  quality: AdminQualityGateSnapshot;
  providerReviewPhase: AdminProviderReviewPhase;
  serviceValidationPhase: AdminServiceValidationPhase;
  providerSupplementPhase?: string | null;
  packStatus?: string | null;
  /** P2 skeleton: when false and ACCEPTED, stay on knowledgeScope. */
  knowledgeScopeReady?: boolean;
}): AdminWorkflowStep {
  const { workerZipPhase, quality, serviceValidationPhase, packStatus } = input;

  // 9. Published packs always park on the publish step.
  if (packStatus === "PUBLISHED" || packStatus === "VERIFIED") {
    return "publish";
  }

  // 1. Nothing accepted yet (or the last zip was rejected at intake) → receipt.
  if (workerZipPhase === "NONE" || workerZipPhase === "REQUESTED" || workerZipPhase === "REJECTED") {
    return "receipt";
  }

  const scopeReady =
    input.knowledgeScopeReady === true ||
    workerZipPhase === "PROCESSING" ||
    workerZipPhase === "COMPLETED" ||
    workerZipPhase === "FAILED";

  // 2. Accepted but scope not yet confirmed (P2 skeleton) → knowledgeScope.
  if (workerZipPhase === "ACCEPTED" && !scopeReady) {
    return "knowledgeScope";
  }

  // 2. Accepted/processing/failed with scope ready → generation.
  if (workerZipPhase === "ACCEPTED" || workerZipPhase === "PROCESSING" || workerZipPhase === "FAILED") {
    return "generation";
  }

  // workerZipPhase === "COMPLETED" from here on.

  // 3. Generation finished but the quality gate hasn't run/finished yet → generation.
  if (!quality.completed) {
    return "generation";
  }

  const hasBlockingQuality = quality.hasBlockers || quality.failCount > 0;
  const openSupplement = isOpenAdminSupplementPhase(input.providerSupplementPhase);

  // 4 & 5. Blockers/failures or an open provider supplement → correction.
  // (Warnings alone do NOT force correction — see module docs.)
  if (hasBlockingQuality || openSupplement) {
    return "correction";
  }

  // 6. Quality clean but service validation hasn't passed yet → serviceValidation.
  if (serviceValidationPhase !== "PASSED") {
    return "serviceValidation";
  }

  // 7 & 8. Service validation passed — publish step hosts the provider-review gate too.
  return "publish";
}
