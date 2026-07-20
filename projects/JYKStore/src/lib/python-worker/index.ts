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
  buildWorkerRunOutputObjectKey,
  buildWorkerRunRagExportObjectKey,
  buildWorkerRunSourceZipObjectKey,
  planWorkerOutputObjectKeys,
  type WorkerOutputStoredFilePlan,
  type WorkerRunObjectKeyContext,
} from "@/lib/python-worker/worker-output-object-keys";

export {
  prepareWorkerOutputImport,
  type PrepareWorkerOutputImportInput,
  type PrepareWorkerOutputImportResult,
  type WorkerOutputImportPayload,
} from "@/lib/python-worker/worker-output-import-service";

export {
  runPythonWorkerCli,
  type PythonWorkerRunInput,
  type PythonWorkerRunResult,
} from "@/lib/python-worker/python-worker-runner";

export {
  describeWorkerZipStage,
  mapWorkerZipStageToPipelineStatus,
  WORKER_ZIP_LOGICAL_STAGES,
  type WorkerZipLogicalStage,
} from "@/lib/python-worker/worker-zip-pipeline-stages";
