/**
 * Thin facade re-exporting the service-validation public surface.
 * Implementation lives in the split modules below — see:
 *  - service-validation-policy.ts        (DTOs + pure helpers)
 *  - service-validation-queries.ts       (shared read/query helpers)
 *  - service-validation-provider-status.ts (provider status DTO mapping)
 *  - service-validation-run-commands.ts  (run a validation channel)
 *  - service-validation-evidence-asserts.ts (submit/approval evidence gates)
 *  - service-validation-admin-listing.ts (admin ops log)
 */

export type { PreparationValidationSnapshotEntry } from "@/lib/distribution/preparation-validation-snapshot-entry";

export type {
  ProviderConfirmationStatusDto,
  ServiceValidationChannelDto,
  ServiceValidationChannelDtoLegacy,
  ServiceValidationLockReason,
  ServiceValidationStatusDto,
} from "@/lib/distribution/service-validation-policy";

export {
  adapterPathForChannel,
  rankingPolicyVersionFromDetails,
  resolveConfirmationStatusDto,
  resolveRunCurrentValidity,
  resolveSearchEvaluationValidity,
  resolveValidationLockReason,
  SEARCH_VALIDATION_PREPARATION_CHANNELS,
} from "@/lib/distribution/service-validation-policy";

export {
  assertNoOpenPackReview,
  findLatestServiceValidationRun,
  loadOwnedPackForServiceValidationRead,
  requireOwnedDraftPackForServiceValidationRun,
} from "@/lib/distribution/service-validation-queries";

export { getServiceValidationStatus } from "@/lib/distribution/service-validation-provider-status";

export { runServiceChannelValidation } from "@/lib/distribution/service-validation-run-commands";

export type { ServiceValidationSubmitSnapshotEntry } from "@/lib/distribution/service-validation-evidence-asserts";

export {
  assertCurrentServiceValidationEvidence,
  assertPreparationServiceValidationsPassed,
  assertSelectedServiceValidationsPassed,
} from "@/lib/distribution/service-validation-evidence-asserts";

export type {
  AdminServiceValidationListResult,
  AdminServiceValidationRunDto,
} from "@/lib/distribution/service-validation-admin-listing";

export {
  getAdminServiceValidationForPack,
  getAdminServiceValidationRun,
  listAdminServiceValidationHistory,
} from "@/lib/distribution/service-validation-admin-listing";

export { isDistributionReadyForServiceValidation } from "@/lib/distribution/service-channel-policy";
export {
  assertSharedConfirmationEvidence,
  canShareProviderConfirmation,
  computeResultFingerprint,
} from "@/lib/distribution/service-validation-share";
