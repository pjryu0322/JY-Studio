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
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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
import { buildWorkerRunSourceZipObjectKey } from "@/lib/python-worker/worker-output-object-keys";
import {
  mapWorkerZipStageToPipelineStatus,
  type WorkerZipLogicalStage,
} from "@/lib/python-worker/worker-zip-pipeline-stages";
import { ensureWorkerSourceDocuments } from "@/lib/python-worker/worker-source-document-service";
import { getConfiguredObjectStorage } from "@/lib/object-storage/object-storage-factory";

const DEFAULT_OBJECT_STORAGE_PREFIX = "payloads";

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
  makeTempDir: () => string;
  cleanupDir: (dir: string) => void;
  ensureSourceDocuments: (input: {
    payload: WorkerOutputImportPayload;
    productVersion?: string | null;
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
 * Run the ZIP Worker import pipeline. Never throws: failures are captured in the
 * returned result's `error` (with `retryable`) and the temp dir is always cleaned up.
 */
export async function runWorkerZipImportPipeline(
  input: WorkerZipPipelineInput,
): Promise<WorkerZipPipelineResult> {
  const prefix = input.objectStoragePrefix?.trim() || DEFAULT_OBJECT_STORAGE_PREFIX;
  const ctx = {
    prefix,
    packId: input.packId,
    packVersionId: input.packVersionId,
    pipelineRunId: input.pipelineRunId,
  };
  const sourceZipObjectKey = buildWorkerRunSourceZipObjectKey(ctx);
  const warnings: WorkerZipPipelineWarning[] = [];
  const storedObjectKeys: string[] = [];

  const base: WorkerZipPipelineResult = {
    ok: false,
    logicalStage: "SUBMITTED",
    pipelineStatus: mapWorkerZipStageToPipelineStatus("SUBMITTED"),
    sourceZipObjectKey,
    storedObjectKeys,
    importedChunkCount: 0,
    importedEmbeddingCount: 0,
    pgvectorReflected: false,
    vectorUpsertedCount: 0,
    vectorSkippedCount: 0,
    warnings,
  };

  let stage: WorkerZipLogicalStage = "SUBMITTED";
  let outputDir: string | undefined;
  let deps: WorkerZipPipelineDeps;
  try {
    deps = resolveDeps(input);
  } catch (error) {
    // Storage resolution (or dep wiring) failed before we started.
    return {
      ...base,
      error: classifyWorkerZipError(error, "SUBMITTED"),
      pipelineStatus: "FAILED",
    };
  }

  const advance = async (next: WorkerZipLogicalStage) => {
    stage = next;
    const pipelineStatus = mapWorkerZipStageToPipelineStatus(next);
    if (deps.markStage) {
      try {
        await deps.markStage(next, pipelineStatus);
      } catch {
        // stage tracking is best-effort
      }
    }
    return pipelineStatus;
  };

  try {
    await advance("ACCEPTED");

    // 1. Store the original ZIP.
    await advance("ARCHIVE_STORED");
    const zipBytes = deps.readFileBytes(input.inputZipPath);
    await deps.storage.putSmallObject({
      packId: input.packId,
      versionId: input.packVersionId,
      payloadId: input.pipelineRunId,
      originalFileName: "original.zip",
      mimeType: "application/zip",
      bytes: zipBytes,
      checksumSha256: sha256Hex(zipBytes),
      objectKey: sourceZipObjectKey,
    });

    // 2. Temp working dir + 3. run the Python Worker.
    outputDir = deps.makeTempDir();
    await advance("WORKER_RUNNING");
    const run = await deps.runWorker({
      inputZipPath: input.inputZipPath,
      outputDir,
      packName: input.packName,
      productVersion: input.productVersion,
      language: input.language,
      scriptPath: input.workerScriptPath,
      pythonPath: input.pythonPath,
      maxFileBytes: input.maxFileBytes,
      maxTotalBytes: input.maxTotalBytes,
      env: input.env,
    });
    if (!run.ok) {
      throw new WorkerZipPipelineFailure({
        code: run.timedOut ? "WORKER_RUN_TIMEOUT" : "WORKER_RUN_FAILED",
        message: run.errorMessage,
        retryable: run.timedOut,
        stage,
      });
    }
    base.workerStdoutTail = run.stdout.slice(-4000);
    base.workerStderrTail = run.stderr.slice(-4000);
    await advance("WORKER_OUTPUT_CREATED");

    // 4. Validate worker output (no chunk regen).
    const prepared = deps.prepareImport({
      outputDir,
      packId: input.packId,
      packVersionId: input.packVersionId,
      pipelineRunId: input.pipelineRunId,
      objectStoragePrefix: prefix,
    });
    if (!prepared.ok) {
      const first = prepared.errors[0];
      throw new WorkerZipPipelineFailure({
        code: first?.code ?? "WORKER_OUTPUT_INVALID",
        message: first?.message ?? "worker output failed validation",
        retryable: false,
        stage,
      });
    }
    const payload = prepared.payload;
    for (const w of payload.warnings) warnings.push(w);

    if (
      payload.validationReport.status !== "ok" ||
      (payload.validationReport.errors?.length ?? 0) > 0
    ) {
      throw new WorkerZipPipelineFailure({
        code: "VALIDATION_REPORT_NOT_OK",
        message: `validation_report.status must be "ok" (got "${payload.validationReport.status ?? "unknown"}")`,
        retryable: false,
        stage,
      });
    }
    await advance("WORKER_OUTPUT_VALIDATED");

    // 5. Store worker output files (keys must match payload.storedFiles).
    for (const file of payload.storedFiles) {
      if (!file.present) {
        if (file.required) {
          throw new WorkerZipPipelineFailure({
            code: "MISSING_REQUIRED_OUTPUT",
            message: `required worker output file missing: ${file.relativePath}`,
            retryable: false,
            stage,
          });
        }
        warnings.push({
          code: "OPTIONAL_OUTPUT_MISSING",
          message: `optional worker output file missing: ${file.relativePath}`,
          path: file.relativePath,
        });
        continue;
      }
      const bytes = deps.readFileBytes(path.join(outputDir, file.relativePath));
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
      storedObjectKeys.push(file.objectKey);
    }
    await advance("WORKER_OUTPUT_STORED");

    // 6. SourceDocument mapping.
    const sourceDocumentIdByPath = await deps.ensureSourceDocuments({
      payload,
      productVersion: input.productVersion,
      prismaClient: input.prismaClient,
    });

    // 7. Bind to a SearchIndexGeneration (creation deferred to P5.x).
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
        stage,
      });
    }

    // 8. Import into Store DB + vector index.
    await advance("IMPORTED");
    const importResult = await deps.importToDb({
      payload,
      searchIndexGenerationId,
      chunkGenerationId: input.chunkGenerationId,
      sourceDocumentIdByPath,
      prismaClient: input.prismaClient,
      requirePgvector: input.requirePgvector,
    });
    if (importResult.vectorSyncWarning) {
      warnings.push({ code: "PGVECTOR_FALLBACK", message: importResult.vectorSyncWarning });
    }

    // 9. Vectors reflected → INDEXING (generation status transitions handled by caller).
    const pipelineStatus = await advance("INDEXING");

    return {
      ...base,
      ok: true,
      logicalStage: stage,
      pipelineStatus,
      storedObjectKeys,
      searchIndexGenerationId,
      chunkGenerationId: importResult.chunkGenerationId,
      importedChunkCount: importResult.importedChunkCount,
      importedEmbeddingCount: importResult.importedEmbeddingCount,
      pgvectorReflected: importResult.pgvectorReflected,
      vectorUpsertedCount: importResult.vectorUpsertedCount,
      vectorSkippedCount: importResult.vectorSkippedCount,
      vectorSyncWarning: importResult.vectorSyncWarning,
      warnings,
    };
  } catch (error) {
    return {
      ...base,
      ok: false,
      logicalStage: stage,
      pipelineStatus: "FAILED",
      storedObjectKeys,
      warnings,
      error: classifyWorkerZipError(error, stage),
    };
  } finally {
    if (outputDir) {
      try {
        deps.cleanupDir(outputDir);
      } catch {
        // cleanup best-effort
      }
    }
  }
}
