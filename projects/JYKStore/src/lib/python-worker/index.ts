/**
 * Public surface for ZIP → Python Worker → Store import.
 *
 * Design rule: Worker produces local output only; Store validates, stores in
 * Object Storage, and imports chunks/source_trace without regenerating chunks.
 */

export {
  IMPORT_CHANNELS,
  isLegacyDoclingImportChannel,
  isWorkerZipImportChannel,
  type ImportChannel,
} from "@/lib/python-worker/import-channel";

export {
  WORKER_NON_CHUNKABLE_CLASSIFICATIONS,
  WORKER_OUTPUT_OPTIONAL_FILES,
  WORKER_OUTPUT_REQUIRED_FILES,
  type WorkerChunk,
  type WorkerEmbedding,
  type WorkerInventoryEntry,
  type WorkerNormalizedDocument,
  type WorkerOutputBundle,
  type WorkerOutputValidationIssue,
  type WorkerOutputValidationResult,
  type WorkerSourceTrace,
  type WorkerValidationReport,
} from "@/lib/python-worker/worker-output-contract";

export {
  validateWorkerOutputBundle,
  validateWorkerOutputDirectory,
} from "@/lib/python-worker/worker-output-validator";

export {
  buildWorkerRequestSourceZipObjectKey,
  buildWorkerRunOutputObjectKey,
  buildWorkerRunRagExportObjectKey,
  buildWorkerRunSourceZipObjectKey,
  buildWorkerSourceRevisionZipObjectKey,
  buildWorkerWorkingCopyZipObjectKey,
  isWorkerRequestStableZipObjectKey,
  planWorkerOutputObjectKeys,
  type WorkerOutputStoredFilePlan,
  type WorkerRequestObjectKeyContext,
  type WorkerRunObjectKeyContext,
} from "@/lib/python-worker/worker-output-object-keys";

export {
  getWorkerZipRequestBytes,
  getWorkerZipRequestMetadata,
  storeWorkerZipRequest,
  type StoredWorkerZipRequest,
  type WorkerZipRequestMetadata,
} from "@/lib/python-worker/worker-zip-request-storage";

export {
  activateWorkerZipSourceRevision,
  getLatestWorkerZipSourceRevision,
  getWorkerZipSourceRevisionById,
  getWorkerZipSourceRevisionBytes,
  lazyBackfillWorkerZipSourceRevisionFromLegacy,
  markWorkerZipSourceRevisionProcessing,
  repairUnsafeWorkerZipSourceRevisionStorageKey,
  storeWorkerZipSourceRevision,
  type WorkerZipSourceRevisionRecord,
} from "@/lib/python-worker/worker-zip-source-revision-service";

export {
  adminExcludePathsFromDirectiveSnapshot,
  buildWorkerWorkingCopyDirectiveSnapshot,
  buildWorkerWorkingCopyIdempotencyKey,
  createWorkerZipWorkingCopyFromRevision,
  markWorkerZipWorkingCopyFailed,
  markWorkerZipWorkingCopyProcessing,
  withVerifiedWorkingCopyTempFile,
  type WorkerWorkingCopyDirectiveSnapshot,
  type WorkerZipWorkingCopyRecord,
} from "@/lib/python-worker/worker-zip-working-copy-service";

export {
  prepareWorkerOutputImport,
  type PrepareWorkerOutputImportInput,
  type PrepareWorkerOutputImportResult,
  type WorkerOutputImportPayload,
} from "@/lib/python-worker/worker-output-import-service";

export {
  assertGenerationDescriptorMatches,
  assertGenerationImportable,
  assertWorkerOutputImportable,
  buildWorkerOutputImportPlan,
  importWorkerOutputToStoreDb,
  resolveWorkerImportChunkGenerationId,
  WORKER_RETRIEVAL_CHUNK_TYPE,
  WorkerOutputDbImportError,
  type ImportSearchGenerationDescriptor,
  type WorkerChunkCreatePlan,
  type WorkerEmbeddingCreatePlan,
  type WorkerOutputDbImportInput,
  type WorkerOutputDbImportResult,
  type WorkerOutputImportPlan,
} from "@/lib/python-worker/worker-output-db-import-service";

export {
  runPythonWorkerCli,
  type PythonWorkerRunInput,
  type PythonWorkerRunResult,
} from "@/lib/python-worker/python-worker-runner";

export {
  ensureWorkerSourceDocuments,
  WORKER_ZIP_SOURCE_LEGACY_TYPE,
  type EnsureWorkerSourceDocumentsInput,
} from "@/lib/python-worker/worker-source-document-service";

export {
  classifyWorkerZipError,
  runWorkerZipImportPipeline,
  WorkerZipPipelineFailure,
  type WorkerZipPipelineDeps,
  type WorkerZipPipelineError,
  type WorkerZipPipelineInput,
  type WorkerZipPipelineResult,
  type WorkerZipPipelineWarning,
  type WorkerZipStorage,
} from "@/lib/python-worker/worker-zip-pipeline-service";

export {
  describeWorkerZipStage,
  mapWorkerZipStageToPipelineStatus,
  WORKER_ZIP_LOGICAL_STAGES,
  type WorkerZipLogicalStage,
} from "@/lib/python-worker/worker-zip-pipeline-stages";

export {
  computeWorkerZipNormalizedDocumentFingerprint,
  deriveWorkerZipEmbeddingDescriptor,
  synthesizeWorkerZipSearchGeneration,
  WORKER_ZIP_ADAPTER_TYPE,
  WORKER_ZIP_BRIDGE_SOURCE,
  WorkerZipGenerationBridgeError,
  type SynthesizeWorkerZipSearchGenerationInput,
  type SynthesizeWorkerZipSearchGenerationResult,
} from "@/lib/python-worker/worker-zip-generation-bridge";

export {
  acceptAdminWorkerZipRequest,
  acknowledgeProviderWorkerZipRejection,
  cancelAdminWorkerZipRejection,
  getProviderWorkerZipRequestState,
  listAdminWorkerZipRequests,
  mapWorkerZipFailureCode,
  resolveAdminDraftPack,
  resolveProviderAdminGenerationHold,
  runAdminWorkerZipGeneration,
  runProviderWorkerZipImport,
  submitProviderWorkerZipRequest,
  withdrawProviderWorkerZipRequest,
  WORKER_ZIP_REQUEST_ACCEPTED_STATUS,
  WORKER_ZIP_REQUEST_TRIGGER,
  WorkerZipImportServiceError,
  type ProviderAdminGenerationHold,
  type AcceptAdminWorkerZipRequestInput,
  type AcknowledgeProviderWorkerZipRejectionInput,
  type AdminWorkerZipRequestListItem,
  type CancelAdminWorkerZipRejectionInput,
  type ProviderWorkerZipImportResult,
  type ProviderWorkerZipRequestState,
  type ProviderWorkerZipRequestStatus,
  type RunAdminWorkerZipGenerationInput,
  type RunProviderWorkerZipImportInput,
  type SubmitProviderWorkerZipRequestInput,
  type WithdrawProviderWorkerZipRequestInput,
  type WorkerZipImportUserError,
  type WorkerZipPackResolver,
} from "@/lib/python-worker/worker-zip-import-provider-service";

export {
  resetWorkerZipSuccessorStateAfterGeneration,
  type WorkerZipSuccessorResetResult,
} from "@/lib/python-worker/worker-zip-successor-reset";
