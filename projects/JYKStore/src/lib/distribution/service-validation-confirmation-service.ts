/**
 * Facade: provider service-validation confirmation + download-test.
 * Public import path unchanged for API routes and tests.
 */
export {
  DOWNLOAD_REJECTION_REASONS,
  RETRIEVAL_REJECTION_REASONS,
} from "@/lib/distribution/service-validation-confirmation-constants";

export {
  confirmServiceValidationRun,
  rejectServiceValidationRun,
  type ConfirmDownloadInput,
  type ConfirmRetrievalInput,
} from "@/lib/distribution/service-validation-confirmation-confirm-reject";

export {
  commitSuccessfulDownloadTestEvidence,
  prepareProviderDownloadTest,
  recordSuccessfulDownloadTestEvidence,
  requireOwnedRunForPreview,
  type PreparedProviderDownloadTest,
} from "@/lib/distribution/service-validation-download-test-service";
