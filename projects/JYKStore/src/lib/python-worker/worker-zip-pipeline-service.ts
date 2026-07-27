/**
 * P5: orchestrate a ZIP Worker import end-to-end (library-level).
 *
 * Flow (this slice):
 *   store source ZIP → run Python Worker → validate output →
 *   store worker output → SourceDocument mapping → bind to a SearchIndexGeneration →
 *   import into Store DB + vector index → report result/warnings.
 *
 * Boundaries kept intact:
 * - The Python Worker never touches Store DB / Object Storage / pgvector.
 * - Worker output is imported as-is (no TS re-chunk / re-embed).
 * - SearchIndexGeneration / NormalizedDocument creation is DEFERRED (P5.x): this
 *   service binds to an EXISTING `searchIndexGenerationId` (or one produced by an
 *   injected resolver). It never invents a generation.
 * - HTTP route + async job model are a later slice.
 *
 * Everything external (worker runner, storage, importer, fs, source-document
 * builder, generation resolver) is injectable so this is unit-testable without
 * Python / pgvector / Object Storage / a real DB.
 */
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PipelineStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  runPythonWorkerCli,
  type PythonWorkerRunInput,
  type PythonWorkerRunResult,
} from "@/lib/python-worker/python-worker-runner";
import {
  importWorkerOutputToStoreDb,
  WorkerOutputDbImportError,
  type WorkerOutputDbImportInput,
  type WorkerOutputDbImportResult,
} from "@/lib/python-worker/worker-output-db-import-service";
import {
  prepareWorkerOutputImport,
  type PrepareWorkerOutputImportInput,
  type PrepareWorkerOutputImportResult,
  type WorkerOutputImportPayload,
} from "@/lib/python-worker/worker-output-import-service";
import {
  readWorkerExclusionSummary,
  type WorkerExclusionSummary,
} from "@/lib/python-worker/worker-output-contract";
import { buildWorkerRunSourceZipObjectKey } from "@/lib/python-worker/worker-output-object-keys";
import {
  mapWorkerZipStageToPipelineStatus,
  type WorkerZipLogicalStage,
} from "@/lib/python-worker/worker-zip-pipeline-stages";
import { ensureWorkerSourceDocuments } from "@/lib/python-worker/worker-source-document-service";
import { getConfiguredObjectStorage } from "@/lib/object-storage/object-storage-factory";

const DEFAULT_OBJECT_STORAGE_PREFIX = "payloads";

/**
 * Memory-safety guards (P5.1): source ZIP and worker output are still read fully
 * into memory (`readFileBytes` + `putSmallObject`). Until streaming/multipart is
 * decided (P5.2), oversized files are rejected before they are read.
 */
const DEFAULT_MAX_SOURCE_ZIP_UPLOAD_BYTES = 200 * 1024 * 1024;
const DEFAULT_MAX_WORKER_OUTPUT_UPLOAD_BYTES = 100 * 1024 * 1024;

/** Error codes classified as retryable (transient). */
const RETRYABLE_CODES = new Set<string>([
  "WORKER_RUN_TIMEOUT",
  "PAYLOAD_STORAGE_UNAVAILABLE",
  "SEARCH_RUNTIME_UNAVAILABLE",
  "LOCK_CONFLICT",
]);

export type WorkerZipPipelineWarning = { code: string; message: string; path?: string };

export type WorkerZipPipelineError = {
  code: string;
  message: string;
  retryable: boolean;
  stage: WorkerZipLogicalStage;
};

export class WorkerZipPipelineFailure extends Error {
  code: string;
  retryable: boolean;
  stage: WorkerZipLogicalStage;
  constructor(input: {
    code: string;
    message: string;
    retryable: boolean;
    stage: WorkerZipLogicalStage;
  }) {
    super(input.message);
    this.name = "WorkerZipPipelineFailure";
    this.code = input.code;
    this.retryable = input.retryable;
    this.stage = input.stage;
  }
}

/** Minimal object-storage surface this service needs (satisfied by ObjectStorageBackend). */
export type WorkerZipStorage = {
  putSmallObject(input: {
    packId: string;
    versionId: string;
    payloadId: string;
    originalFileName: string;
    mimeType: string;
    bytes: Uint8Array;
    checksumSha256: string;
    objectKey?: string;
  }): Promise<{ objectKey: string }>;
};

export type WorkerZipPipelineDeps = {
  runWorker: (input: PythonWorkerRunInput) => Promise<PythonWorkerRunResult>;
  prepareImport: (input: PrepareWorkerOutputImportInput) => PrepareWorkerOutputImportResult;
  importToDb: (input: WorkerOutputDbImportInput) => Promise<WorkerOutputDbImportResult>;
  storage: WorkerZipStorage;
  readFileBytes: (absPath: string) => Uint8Array;
  /** Byte size of a local file; used for upload size guards before reading it. */
  getFileSize: (absPath: string) => number;
  makeTempDir: () => string;
  cleanupDir: (dir: string) => void;
  ensureSourceDocuments: (input: {
    payload: WorkerOutputImportPayload;
    productVersion?: string | null;
    sourceRevisionId?: string | null;
    prismaClient?: typeof prisma;
  }) => Promise<Record<string, string>>;
  /** Deferred generation creation hook; when absent, input.searchIndexGenerationId is required. */
  resolveSearchIndexGenerationId?: (ctx: {
    payload: WorkerOutputImportPayload;
    packId: string;
    packVersionId: string;
    pipelineRunId: string;
  }) => Promise<string | undefined>;
  /** Logical-stage tracker (e.g. persist to job/run metadata). Best-effort; never throws. */
  markStage?: (stage: WorkerZipLogicalStage, pipelineStatus: PipelineStatus) => void | Promise<void>;
};

export type WorkerZipPipelineInput = {
  packId: string;
  packVersionId: string;
  pipelineRunId: string;
  inputZipPath: string;
  packName: string;
  productVersion: string;
  language?: string;
  objectStoragePrefix?: string;
  requirePgvector?: boolean;
  /** Bind the import to this existing generation (P5.x defers creation). */
  searchIndexGenerationId?: string;
  chunkGenerationId?: string;
  pythonPath?: string;
  workerScriptPath?: string;
  maxFileBytes?: number;
  maxTotalBytes?: number;
  /** Admin 사전정리 제외 경로 — forwarded to the Python Worker. */
  adminExcludePaths?: readonly string[];
  /** P1: immutable source revision for SourceDocument scoping. */
  sourceRevisionId?: string | null;
  /** Upload size guard for the source ZIP (default 200MB). */
  maxSourceZipUploadBytes?: number;
  /** Upload size guard per worker output file (default 100MB). */
  maxWorkerOutputUploadBytes?: number;
  env?: NodeJS.ProcessEnv;
  prismaClient?: typeof prisma;
  deps?: Partial<WorkerZipPipelineDeps>;
};

export type WorkerZipPipelineResult = {
  ok: boolean;
  logicalStage: WorkerZipLogicalStage;
  pipelineStatus: PipelineStatus;
  sourceZipObjectKey: string;
  storedObjectKeys: string[];
  searchIndexGenerationId?: string;
  chunkGenerationId?: string;
  importedChunkCount: number;
  importedEmbeddingCount: number;
  pgvectorReflected: boolean;
  vectorUpsertedCount: number;
  vectorSkippedCount: number;
  vectorSyncWarning?: string;
  /** P7.4: Worker default-exclusion roll-up (advisory; never affects ok/failure). */
  exclusionSummary?: WorkerExclusionSummary;
  warnings: WorkerZipPipelineWarning[];
  error?: WorkerZipPipelineError;
  workerStdoutTail?: string;
  workerStderrTail?: string;
};

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function mimeForRelativePath(relativePath: string): string {
  if (relativePath.endsWith(".json")) return "application/json";
  if (relativePath.endsWith(".md")) return "text/markdown";
  return "application/octet-stream";
}

function resolveDeps(input: WorkerZipPipelineInput): WorkerZipPipelineDeps {
  const provided = input.deps ?? {};
  return {
    runWorker: provided.runWorker ?? runPythonWorkerCli,
    prepareImport: provided.prepareImport ?? prepareWorkerOutputImport,
    importToDb: provided.importToDb ?? importWorkerOutputToStoreDb,
    // Resolve storage lazily only when not injected (throws if unconfigured).
    storage: provided.storage ?? getConfiguredObjectStorage(input.env),
    readFileBytes: provided.readFileBytes ?? ((p) => readFileSync(p)),
    getFileSize: provided.getFileSize ?? ((p) => statSync(p).size),
    makeTempDir:
      provided.makeTempDir ?? (() => mkdtempSync(path.join(tmpdir(), "jyk-worker-zip-"))),
    cleanupDir: provided.cleanupDir ?? ((dir) => rmSync(dir, { recursive: true, force: true })),
    ensureSourceDocuments: provided.ensureSourceDocuments ?? ensureWorkerSourceDocuments,
    resolveSearchIndexGenerationId: provided.resolveSearchIndexGenerationId,
    markStage: provided.markStage,
  };
}

/**
 * Map an arbitrary thrown error to a typed pipeline error with a retry hint.
 */
export function classifyWorkerZipError(
  error: unknown,
  stage: WorkerZipLogicalStage,
): WorkerZipPipelineError {
  if (error instanceof WorkerZipPipelineFailure) {
    return { code: error.code, message: error.message, retryable: error.retryable, stage: error.stage };
  }
  // DB import errors are all validation/binding violations → non-retryable.
  if (error instanceof WorkerOutputDbImportError) {
    return { code: error.code, message: error.message, retryable: false, stage };
  }
  const code =
    typeof (error as { code?: unknown })?.code === "string"
      ? (error as { code: string }).code
      : "WORKER_ZIP_PIPELINE_ERROR";
  const message = error instanceof Error ? error.message : String(error);
  return { code, message, retryable: RETRYABLE_CODES.has(code), stage };
}

/**
 * Mutable per-run state shared by the pipeline orchestrator and its step helpers.
 *
 * `stage` = the stage currently being attempted (used for error.stage /
 * logicalStage). `base.warnings` and `base.storedObjectKeys` are the SAME array
 * references as `warnings` / `storedObjectKeys`, so pushing to either is
 * reflected when a result spreads `...base`.
 */
type WorkerZipPipelineContext = {
  input: WorkerZipPipelineInput;
  deps: WorkerZipPipelineDeps;
  prefix: string;
  sourceZipObjectKey: string;
  warnings: WorkerZipPipelineWarning[];
  storedObjectKeys: string[];
  base: WorkerZipPipelineResult;
  maxSourceZipUploadBytes: number;
  maxWorkerOutputUploadBytes: number;
  stage: WorkerZipLogicalStage;
  outputDir?: string;
};

/** Build the pristine "not started" result (also the spread base for every branch). */
function emptyBaseResult(sourceZipObjectKey: string): WorkerZipPipelineResult {
  return {
    ok: false,
    logicalStage: "SUBMITTED",
    pipelineStatus: mapWorkerZipStageToPipelineStatus("SUBMITTED"),
    sourceZipObjectKey,
    storedObjectKeys: [],
    importedChunkCount: 0,
    importedEmbeddingCount: 0,
    pgvectorReflected: false,
    vectorUpsertedCount: 0,
    vectorSkippedCount: 0,
    warnings: [],
  };
}

/**
 * Assemble the shared pipeline context. Pure: no storage / worker / DB
 * side-effects (temp dir is only created later, in {@link runPythonWorker}).
 */
function buildPipelineContext(
  input: WorkerZipPipelineInput,
  deps: WorkerZipPipelineDeps,
  prefix: string,
  sourceZipObjectKey: string,
): WorkerZipPipelineContext {
  const base = emptyBaseResult(sourceZipObjectKey);
  return {
    input,
    deps,
    prefix,
    sourceZipObjectKey,
    warnings: base.warnings,
    storedObjectKeys: base.storedObjectKeys,
    base,
    maxSourceZipUploadBytes:
      input.maxSourceZipUploadBytes ?? DEFAULT_MAX_SOURCE_ZIP_UPLOAD_BYTES,
    maxWorkerOutputUploadBytes:
      input.maxWorkerOutputUploadBytes ?? DEFAULT_MAX_WORKER_OUTPUT_UPLOAD_BYTES,
    stage: "SUBMITTED",
  };
}

/**
 * Record `completed` as the current stage and (best-effort) via `markStage`.
 * Only called after the stage's work succeeds (WORKER_RUNNING is the one
 * in-progress exception, recorded right before the worker runs).
 */
async function markStageCompleted(
  ctx: WorkerZipPipelineContext,
  completed: WorkerZipLogicalStage,
): Promise<PipelineStatus> {
  ctx.stage = completed;
  const pipelineStatus = mapWorkerZipStageToPipelineStatus(completed);
  if (ctx.deps.markStage) {
    try {
      await ctx.deps.markStage(completed, pipelineStatus);
    } catch {
      // stage tracking is best-effort
    }
  }
  return pipelineStatus;
}

/**
 * P6 §3 early-fail: when there is no way to obtain a SearchIndexGeneration.
 * A resolver may need the worker output payload before it can resolve, so we
 * only early-fail when neither a bound id nor a resolver exists — before any
 * ZIP storage / temp dir / worker run / output storage / SourceDocument /
 * importToDb. Returns the failure result, or `null` to continue.
 */
function validateGenerationBinding(
  ctx: WorkerZipPipelineContext,
): WorkerZipPipelineResult | null {
  if (!ctx.input.searchIndexGenerationId && !ctx.deps.resolveSearchIndexGenerationId) {
    return {
      ...ctx.base,
      logicalStage: "ACCEPTED",
      pipelineStatus: "FAILED",
      error: {
        code: "SEARCH_GENERATION_REQUIRED",
        message:
          "no searchIndexGenerationId provided and no resolver configured (generation creation is deferred to P5.x)",
        retryable: false,
        stage: "ACCEPTED",
      },
    };
  }
  return null;
}

/** Step 1: store the original ZIP (size-guarded before it is read into memory). */
async function storeSourceArchive(ctx: WorkerZipPipelineContext): Promise<void> {
  ctx.stage = "ARCHIVE_STORED";
  const { input, deps } = ctx;
  const zipSize = deps.getFileSize(input.inputZipPath);
  if (zipSize > ctx.maxSourceZipUploadBytes) {
    throw new WorkerZipPipelineFailure({
      code: "WORKER_ZIP_FILE_TOO_LARGE",
      message: `source ZIP is ${zipSize} bytes, exceeds limit ${ctx.maxSourceZipUploadBytes}`,
      retryable: false,
      stage: ctx.stage,
    });
  }
  const zipBytes = deps.readFileBytes(input.inputZipPath);
  await deps.storage.putSmallObject({
    packId: input.packId,
    versionId: input.packVersionId,
    payloadId: input.pipelineRunId,
    originalFileName: "original.zip",
    mimeType: "application/zip",
    bytes: zipBytes,
    checksumSha256: sha256Hex(zipBytes),
    objectKey: ctx.sourceZipObjectKey,
  });
  await markStageCompleted(ctx, "ARCHIVE_STORED");
}

/**
 * Steps 2–3: create the temp working dir and run the Python Worker.
 * WORKER_RUNNING is recorded as an in-progress stage right before the run.
 * On worker failure this throws (import / SourceDocument are never reached).
 */
async function runPythonWorker(ctx: WorkerZipPipelineContext): Promise<void> {
  const { input, deps } = ctx;
  ctx.outputDir = deps.makeTempDir();
  ctx.stage = "WORKER_RUNNING";
  await markStageCompleted(ctx, "WORKER_RUNNING");
  const run = await deps.runWorker({
    inputZipPath: input.inputZipPath,
    outputDir: ctx.outputDir,
    packName: input.packName,
    productVersion: input.productVersion,
    language: input.language,
    scriptPath: input.workerScriptPath,
    pythonPath: input.pythonPath,
    maxFileBytes: input.maxFileBytes,
    maxTotalBytes: input.maxTotalBytes,
    adminExcludePaths: input.adminExcludePaths,
    env: input.env,
  });
  if (!run.ok) {
    // Capture the worker's own output on failure too, so the Python error/
    // traceback is diagnosable (otherwise only "exited with code N" survives).
    ctx.base.workerStdoutTail = run.stdout.slice(-4000);
    ctx.base.workerStderrTail = run.stderr.slice(-4000);
    throw new WorkerZipPipelineFailure({
      code: run.timedOut ? "WORKER_RUN_TIMEOUT" : "WORKER_RUN_FAILED",
      message: run.errorMessage,
      retryable: run.timedOut,
      stage: ctx.stage,
    });
  }
  ctx.base.workerStdoutTail = run.stdout.slice(-4000);
  ctx.base.workerStderrTail = run.stderr.slice(-4000);
  await markStageCompleted(ctx, "WORKER_OUTPUT_CREATED");
}

/** Step 4: validate worker output (no chunk regen) and collect its warnings. */
async function prepareAndValidateWorkerOutput(
  ctx: WorkerZipPipelineContext,
): Promise<WorkerOutputImportPayload> {
  ctx.stage = "WORKER_OUTPUT_VALIDATED";
  const { input, deps } = ctx;
  const prepared = deps.prepareImport({
    outputDir: ctx.outputDir!,
    packId: input.packId,
    packVersionId: input.packVersionId,
    pipelineRunId: input.pipelineRunId,
    objectStoragePrefix: ctx.prefix,
  });
  if (!prepared.ok) {
    const first = prepared.errors[0];
    throw new WorkerZipPipelineFailure({
      code: first?.code ?? "WORKER_OUTPUT_INVALID",
      message: first?.message ?? "worker output failed validation",
      retryable: false,
      stage: ctx.stage,
    });
  }
  const payload = prepared.payload;
  for (const w of payload.warnings) ctx.warnings.push(w);

  // P7.4: capture the exclusion roll-up as soon as the report is parsed so it is
  // present on both success and failure results (spread via ctx.base).
  ctx.base.exclusionSummary = readWorkerExclusionSummary(payload.validationReport);

  if (
    payload.validationReport.status !== "ok" ||
    (payload.validationReport.errors?.length ?? 0) > 0
  ) {
    throw new WorkerZipPipelineFailure({
      code: "VALIDATION_REPORT_NOT_OK",
      message: `validation_report.status must be "ok" (got "${payload.validationReport.status ?? "unknown"}")`,
      retryable: false,
      stage: ctx.stage,
    });
  }
  await markStageCompleted(ctx, "WORKER_OUTPUT_VALIDATED");
  return payload;
}

/** Step 5: store worker output files (keys must match payload.storedFiles). */
async function storeWorkerOutput(
  ctx: WorkerZipPipelineContext,
  payload: WorkerOutputImportPayload,
): Promise<void> {
  ctx.stage = "WORKER_OUTPUT_STORED";
  const { input, deps } = ctx;
  for (const file of payload.storedFiles) {
    if (!file.present) {
      if (file.required) {
        throw new WorkerZipPipelineFailure({
          code: "MISSING_REQUIRED_OUTPUT",
          message: `required worker output file missing: ${file.relativePath}`,
          retryable: false,
          stage: ctx.stage,
        });
      }
      ctx.warnings.push({
        code: "OPTIONAL_OUTPUT_MISSING",
        message: `optional worker output file missing: ${file.relativePath}`,
        path: file.relativePath,
      });
      continue;
    }
    const absPath = path.join(ctx.outputDir!, file.relativePath);
    const fileSize = deps.getFileSize(absPath);
    if (fileSize > ctx.maxWorkerOutputUploadBytes) {
      throw new WorkerZipPipelineFailure({
        code: "WORKER_OUTPUT_FILE_TOO_LARGE",
        message: `worker output ${file.relativePath} is ${fileSize} bytes, exceeds limit ${ctx.maxWorkerOutputUploadBytes}`,
        retryable: false,
        stage: ctx.stage,
      });
    }
    const bytes = deps.readFileBytes(absPath);
    await deps.storage.putSmallObject({
      packId: input.packId,
      versionId: input.packVersionId,
      payloadId: input.pipelineRunId,
      originalFileName: path.posix.basename(file.relativePath.replace(/\\/g, "/")),
      mimeType: mimeForRelativePath(file.relativePath),
      bytes,
      checksumSha256: file.sha256,
      objectKey: file.objectKey,
    });
    ctx.storedObjectKeys.push(file.objectKey);
  }
  await markStageCompleted(ctx, "WORKER_OUTPUT_STORED");
}

/**
 * Step 6: bind to a SearchIndexGeneration BEFORE any DB side-effect (creation
 * deferred to P5.x). Done before persistSourceDocuments so a missing binding
 * fails without persisting SourceDocument rows.
 */
async function resolveGenerationBinding(
  ctx: WorkerZipPipelineContext,
  payload: WorkerOutputImportPayload,
): Promise<string> {
  const { input, deps } = ctx;
  const searchIndexGenerationId =
    input.searchIndexGenerationId ??
    (deps.resolveSearchIndexGenerationId
      ? await deps.resolveSearchIndexGenerationId({
          payload,
          packId: input.packId,
          packVersionId: input.packVersionId,
          pipelineRunId: input.pipelineRunId,
        })
      : undefined);
  if (!searchIndexGenerationId) {
    throw new WorkerZipPipelineFailure({
      code: "SEARCH_GENERATION_REQUIRED",
      message:
        "no searchIndexGenerationId provided and no resolver configured (generation creation is deferred to P5.x)",
      retryable: false,
      stage: ctx.stage,
    });
  }
  return searchIndexGenerationId;
}

/** Step 7: SourceDocument mapping (only after the generation is bound). */
function persistSourceDocuments(
  ctx: WorkerZipPipelineContext,
  payload: WorkerOutputImportPayload,
): Promise<Record<string, string>> {
  return ctx.deps.ensureSourceDocuments({
    payload,
    productVersion: ctx.input.productVersion,
    sourceRevisionId: ctx.input.sourceRevisionId,
    prismaClient: ctx.input.prismaClient,
  });
}

/** Step 8: import worker output into Store DB + vector index (no TS re-chunk/re-embed). */
async function importWorkerResult(
  ctx: WorkerZipPipelineContext,
  payload: WorkerOutputImportPayload,
  searchIndexGenerationId: string,
  sourceDocumentIdByPath: Record<string, string>,
): Promise<WorkerOutputDbImportResult> {
  ctx.stage = "IMPORTED";
  const importResult = await ctx.deps.importToDb({
    payload,
    searchIndexGenerationId,
    chunkGenerationId: ctx.input.chunkGenerationId,
    sourceDocumentIdByPath,
    prismaClient: ctx.input.prismaClient,
    requirePgvector: ctx.input.requirePgvector,
  });
  await markStageCompleted(ctx, "IMPORTED");
  if (importResult.vectorSyncWarning) {
    ctx.warnings.push({ code: "PGVECTOR_FALLBACK", message: importResult.vectorSyncWarning });
  }
  return importResult;
}

/** Step 9: vectors reflected → INDEXING (generation status transitions handled by caller). */
async function buildPipelineSuccessResult(
  ctx: WorkerZipPipelineContext,
  searchIndexGenerationId: string,
  importResult: WorkerOutputDbImportResult,
): Promise<WorkerZipPipelineResult> {
  const pipelineStatus = await markStageCompleted(ctx, "INDEXING");
  return {
    ...ctx.base,
    ok: true,
    logicalStage: ctx.stage,
    pipelineStatus,
    storedObjectKeys: ctx.storedObjectKeys,
    searchIndexGenerationId,
    chunkGenerationId: importResult.chunkGenerationId,
    importedChunkCount: importResult.importedChunkCount,
    importedEmbeddingCount: importResult.importedEmbeddingCount,
    pgvectorReflected: importResult.pgvectorReflected,
    vectorUpsertedCount: importResult.vectorUpsertedCount,
    vectorSkippedCount: importResult.vectorSkippedCount,
    vectorSyncWarning: importResult.vectorSyncWarning,
    warnings: ctx.warnings,
  };
}

/** Map a thrown error to the failure result, preserving the attempted stage. */
function handlePipelineFailure(
  ctx: WorkerZipPipelineContext,
  error: unknown,
): WorkerZipPipelineResult {
  return {
    ...ctx.base,
    ok: false,
    logicalStage: ctx.stage,
    pipelineStatus: "FAILED",
    storedObjectKeys: ctx.storedObjectKeys,
    warnings: ctx.warnings,
    error: classifyWorkerZipError(error, ctx.stage),
  };
}

/** Best-effort temp cleanup; a no-op on paths where no temp dir was created (early-fail). */
function cleanupPipelineTempFiles(ctx: WorkerZipPipelineContext): void {
  if (ctx.outputDir) {
    try {
      ctx.deps.cleanupDir(ctx.outputDir);
    } catch {
      // cleanup best-effort
    }
  }
}

/**
 * Run the ZIP Worker import pipeline. Never throws: failures are captured in the
 * returned result's `error` (with `retryable`) and the temp dir is always cleaned up.
 *
 * This is a thin orchestrator; each numbered step lives in a helper above so the
 * side-effect order (store ZIP → run worker → validate → store output → bind
 * generation → SourceDocument → import) stays visible and easy to extend.
 */
export async function runWorkerZipImportPipeline(
  input: WorkerZipPipelineInput,
): Promise<WorkerZipPipelineResult> {
  const prefix = input.objectStoragePrefix?.trim() || DEFAULT_OBJECT_STORAGE_PREFIX;
  const sourceZipObjectKey = buildWorkerRunSourceZipObjectKey({
    prefix,
    packId: input.packId,
    packVersionId: input.packVersionId,
    pipelineRunId: input.pipelineRunId,
  });

  let deps: WorkerZipPipelineDeps;
  try {
    deps = resolveDeps(input);
  } catch (error) {
    // Storage resolution (or dep wiring) failed before we started.
    return {
      ...emptyBaseResult(sourceZipObjectKey),
      error: classifyWorkerZipError(error, "SUBMITTED"),
      pipelineStatus: "FAILED",
    };
  }

  const ctx = buildPipelineContext(input, deps, prefix, sourceZipObjectKey);

  // Early-fail (no side-effects) before any temp dir / storage / worker run.
  const bindingError = validateGenerationBinding(ctx);
  if (bindingError) return bindingError;

  try {
    await markStageCompleted(ctx, "ACCEPTED");
    await storeSourceArchive(ctx);
    await runPythonWorker(ctx);
    const payload = await prepareAndValidateWorkerOutput(ctx);
    await storeWorkerOutput(ctx, payload);
    const searchIndexGenerationId = await resolveGenerationBinding(ctx, payload);
    const sourceDocumentIdByPath = await persistSourceDocuments(ctx, payload);
    const importResult = await importWorkerResult(
      ctx,
      payload,
      searchIndexGenerationId,
      sourceDocumentIdByPath,
    );
    return await buildPipelineSuccessResult(ctx, searchIndexGenerationId, importResult);
  } catch (error) {
    return handlePipelineFailure(ctx, error);
  } finally {
    cleanupPipelineTempFiles(ctx);
  }
}
