/**
 * Facade re-exporting the split `provider-pack` service modules so existing
 * `@/lib/provider-pack-service` imports keep working unchanged.
 */
export type {
  CreateProviderPackInput,
  UpdateProviderPackInput,
  CreatePackVersionInput,
  CreateSourceDocumentInput,
} from "@/lib/provider-pack/provider-pack-types";

export {
  listProviderPacksForClient,
  getProviderPackForClient,
  assertProviderPackEditableForClient,
} from "@/lib/provider-pack/provider-pack-query-service";

export {
  createProviderPackForClient,
  updateProviderPackForClient,
} from "@/lib/provider-pack/provider-pack-write-service";

export { createProviderPackVersionForClient } from "@/lib/provider-pack/provider-pack-version-service";

export {
  createSourceDocumentForProviderPack,
  validateProviderSourceDocument,
} from "@/lib/provider-pack/provider-pack-source-document-service";

export {
  submitProviderPackForReview,
  withdrawProviderPackFromReview,
} from "@/lib/provider-pack/provider-pack-review-submit-service";

export {
  evaluateProviderPackStructureQuality,
  evaluateProviderPackChunkQuality,
  generateProviderPackRetrievalEvaluationCases,
  runProviderPackRetrievalEvaluation,
  runProviderPackInspectionAutoPrepare,
  evaluateProviderPackReleaseGate,
} from "@/lib/provider-pack/provider-pack-quality-eval-service";
