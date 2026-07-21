import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IMPORT_CHANNELS,
  mapWorkerZipStageToPipelineStatus,
  runWorkerZipImportPipeline,
  WorkerOutputDbImportError,
  ensureWorkerSourceDocuments,
  WORKER_ZIP_SOURCE_LEGACY_TYPE,
  type WorkerOutputImportPayload,
  type WorkerZipPipelineDeps,
  type WorkerZipPipelineInput,
} from "../lib/python-worker/index.ts";

function makePayload(
  overrides?: Partial<WorkerOutputImportPayload>,
): WorkerOutputImportPayload {
  return {
    importChannel: IMPORT_CHANNELS.WORKER_ZIP_IMPORT,
    regenerateChunks: false,
    packId: "pack1",
    packVersionId: "ver1",
    pipelineRunId: "run1",
    parserVersion: "0.1.0",
    sourceZip: { objectKey: "payloads/packs/pack1/versions/ver1/runs/run1/source/original.zip" },
    storedFiles: [
      {
        relativePath: "chunks.json",
        objectKey: "payloads/packs/pack1/versions/ver1/runs/run1/worker-output/chunks.json",
        sizeBytes: 12,
        sha256: "a".repeat(64),
        required: true,
        present: true,
      },
      {
        relativePath: "embeddings.json",
        objectKey: "payloads/packs/pack1/versions/ver1/runs/run1/worker-output/embeddings.json",
        sizeBytes: 12,
        sha256: "b".repeat(64),
        required: true,
        present: true,
      },
      {
        relativePath: "normalized_documents.md",
        objectKey:
          "payloads/packs/pack1/versions/ver1/runs/run1/worker-output/normalized_documents.md",
        sizeBytes: 0,
        sha256: "",
        required: false,
        present: false,
      },
    ],
    chunks: [
      {
        chunkId: "c1",
        title: "T",
        content: "content",
        sourcePath: "Docs/a.html",
        traceId: "t1",
      },
    ],
    embeddings: [
      {
        chunkId: "c1",
        provider: "local",
        model: "e5-small",
        dimension: 3,
        vector: [0.1, 0.2, 0.3],
        contentHash: "h1",
      },
    ],
    sourceTraces: [
      {
        traceId: "t1",
        sourcePath: "Docs/a.html",
        sourceHash: "sha-a",
        parser: "html_api",
        parserVersion: "0.1.0",
      },
    ],
    normalizedDocuments: [
      { documentId: "d1", sourcePath: "Docs/a.html", sourceType: "html_api", title: "A" },
    ],
    inventory: [{ sourcePath: "Docs/a.html", classification: "knowledge_target", sha256: "sha-a" }],
    validationReport: { status: "ok", errors: [], warnings: [], totals: { chunks: 1 } },
    pipelineStatusAfterImport: mapWorkerZipStageToPipelineStatus("IMPORTED"),
    logicalStage: "IMPORTED",
    warnings: [],
    ...overrides,
  };
}

type StorageCall = { objectKey?: string; originalFileName: string; mimeType: string };

function makeDeps(overrides?: Partial<WorkerZipPipelineDeps>) {
  const storageCalls: StorageCall[] = [];
  const importCalls: Array<Record<string, unknown>> = [];
  let cleanupCalls = 0;
  let ensureSourceDocsCalls = 0;
  const stages: string[] = [];
  const deps: WorkerZipPipelineDeps = {
    runWorker: async () => ({
      ok: true,
      exitCode: 0,
      stdout: "ok",
      stderr: "",
      durationMs: 1,
      outputDir: "/tmp/fake",
    }),
    prepareImport: () => ({ ok: true, payload: makePayload() }),
    importToDb: async (input) => {
      importCalls.push(input as unknown as Record<string, unknown>);
      return {
        packVersionId: "ver1",
        chunkGenerationId: "cg1",
        searchIndexGenerationId: input.searchIndexGenerationId ?? "sig1",
        importedChunkCount: 1,
        importedEmbeddingCount: 1,
        chunkIdByWorkerChunkId: { c1: "chunk-db-1" },
        pgvectorReflected: true,
        vectorUpsertedCount: 1,
        vectorSkippedCount: 0,
      };
    },
    storage: {
      putSmallObject: async (input) => {
        storageCalls.push({
          objectKey: input.objectKey,
          originalFileName: input.originalFileName,
          mimeType: input.mimeType,
        });
        return { objectKey: input.objectKey ?? "generated-key" };
      },
    },
    readFileBytes: () => new Uint8Array([1, 2, 3]),
    getFileSize: () => 100,
    makeTempDir: () => "/tmp/fake",
    cleanupDir: () => {
      cleanupCalls += 1;
    },
    ensureSourceDocuments: async () => {
      ensureSourceDocsCalls += 1;
      return { "Docs/a.html": "srcdoc-1" };
    },
    markStage: (stage) => {
      stages.push(stage);
    },
    ...overrides,
  };
  return {
    deps,
    storageCalls,
    importCalls,
    stages,
    getCleanupCalls: () => cleanupCalls,
    getEnsureSourceDocsCalls: () => ensureSourceDocsCalls,
  };
}

function baseInput(overrides?: Partial<WorkerZipPipelineInput>): WorkerZipPipelineInput {
  return {
    packId: "pack1",
    packVersionId: "ver1",
    pipelineRunId: "run1",
    inputZipPath: "/tmp/original.zip",
    packName: "Pack",
    productVersion: "1.0.0",
    searchIndexGenerationId: "sig1",
    ...overrides,
  };
}

describe("worker-zip-pipeline-service (P5)", () => {
  it("runs the full happy path: store zip → worker → validate → store output → import", async () => {
    const { deps, storageCalls, importCalls, stages, getCleanupCalls } = makeDeps();
    const result = await runWorkerZipImportPipeline(baseInput({ deps }));

    assert.equal(result.ok, true);
    assert.equal(result.logicalStage, "INDEXING");
    // completion-stage order preserved
    assert.deepEqual(stages, [
      "ACCEPTED",
      "ARCHIVE_STORED",
      "WORKER_RUNNING",
      "WORKER_OUTPUT_CREATED",
      "WORKER_OUTPUT_VALIDATED",
      "WORKER_OUTPUT_STORED",
      "IMPORTED",
      "INDEXING",
    ]);
    assert.equal(result.importedChunkCount, 1);
    assert.equal(result.importedEmbeddingCount, 1);
    assert.equal(result.pgvectorReflected, true);
    assert.equal(result.searchIndexGenerationId, "sig1");
    // source zip stored first, then the two present output files (md skipped)
    assert.equal(storageCalls[0]?.objectKey, result.sourceZipObjectKey);
    assert.equal(storageCalls[0]?.mimeType, "application/zip");
    assert.ok(storageCalls.some((c) => c.originalFileName === "chunks.json"));
    assert.ok(storageCalls.some((c) => c.originalFileName === "embeddings.json"));
    assert.ok(!storageCalls.some((c) => c.originalFileName === "normalized_documents.md"));
    assert.equal(result.storedObjectKeys.length, 2);
    // importToDb received the source-document mapping + generation binding
    assert.equal(importCalls.length, 1);
    assert.deepEqual(importCalls[0]?.sourceDocumentIdByPath, { "Docs/a.html": "srcdoc-1" });
    assert.equal(importCalls[0]?.searchIndexGenerationId, "sig1");
    assert.equal(getCleanupCalls(), 1);
  });

  it("does not import when the Python Worker fails (and marks timeout retryable)", async () => {
    const { deps, importCalls, getCleanupCalls } = makeDeps({
      runWorker: async () => ({
        ok: false,
        exitCode: null,
        stdout: "",
        stderr: "boom",
        durationMs: 1,
        timedOut: true,
        errorMessage: "Python Worker timed out",
      }),
    });
    const result = await runWorkerZipImportPipeline(baseInput({ deps }));
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, "WORKER_RUN_TIMEOUT");
    assert.equal(result.error?.retryable, true);
    assert.equal(result.error?.stage, "WORKER_RUNNING");
    assert.equal(importCalls.length, 0);
    assert.equal(getCleanupCalls(), 1);
  });

  it("does not import when validation_report.status !== ok (non-retryable)", async () => {
    const { deps, importCalls } = makeDeps({
      prepareImport: () => ({
        ok: true,
        payload: makePayload({
          validationReport: { status: "partial", errors: [], warnings: [] },
        }),
      }),
    });
    const result = await runWorkerZipImportPipeline(baseInput({ deps }));
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, "VALIDATION_REPORT_NOT_OK");
    assert.equal(result.error?.retryable, false);
    assert.equal(importCalls.length, 0);
  });

  it("does not import when a required output upload fails (storage transient → retryable)", async () => {
    const { deps, importCalls } = makeDeps({
      storage: {
        putSmallObject: async (input) => {
          if (input.originalFileName.endsWith(".json")) {
            throw Object.assign(new Error("s3 down"), { code: "PAYLOAD_STORAGE_UNAVAILABLE" });
          }
          return { objectKey: input.objectKey ?? "k" };
        },
      },
    });
    const result = await runWorkerZipImportPipeline(baseInput({ deps }));
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, "PAYLOAD_STORAGE_UNAVAILABLE");
    assert.equal(result.error?.retryable, true);
    assert.equal(importCalls.length, 0);
  });

  it("fails non-retryable on generation descriptor mismatch", async () => {
    const { deps } = makeDeps({
      importToDb: async () => {
        throw new WorkerOutputDbImportError(
          "SEARCH_GENERATION_DESCRIPTOR_MISMATCH",
          "descriptor mismatch",
        );
      },
    });
    const result = await runWorkerZipImportPipeline(baseInput({ deps }));
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, "SEARCH_GENERATION_DESCRIPTOR_MISMATCH");
    assert.equal(result.error?.retryable, false);
  });

  it("requirePgvector=true: pgvector unavailable propagates as retryable failure", async () => {
    let importInvoked = false;
    let sawRequirePgvector = false;
    const { deps } = makeDeps({
      importToDb: async (input) => {
        importInvoked = true;
        sawRequirePgvector = input.requirePgvector === true;
        throw Object.assign(new Error("pgvector down"), { code: "SEARCH_RUNTIME_UNAVAILABLE" });
      },
    });
    const result = await runWorkerZipImportPipeline(baseInput({ deps, requirePgvector: true }));
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, "SEARCH_RUNTIME_UNAVAILABLE");
    assert.equal(result.error?.retryable, true);
    assert.equal(importInvoked, true);
    assert.equal(sawRequirePgvector, true);
  });

  it("dev/test fallback records the pgvector warning and stays ok", async () => {
    const { deps } = makeDeps({
      importToDb: async (input) => ({
        packVersionId: "ver1",
        chunkGenerationId: "cg1",
        searchIndexGenerationId: input.searchIndexGenerationId ?? "sig1",
        importedChunkCount: 1,
        importedEmbeddingCount: 1,
        chunkIdByWorkerChunkId: { c1: "chunk-db-1" },
        pgvectorReflected: false,
        vectorUpsertedCount: 0,
        vectorSkippedCount: 1,
        vectorSyncWarning: "pgvector unavailable — JSON-only fallback (dev/test).",
      }),
    });
    const result = await runWorkerZipImportPipeline(baseInput({ deps }));
    assert.equal(result.ok, true);
    assert.equal(result.vectorSkippedCount, 1);
    assert.equal(result.pgvectorReflected, false);
    assert.ok(result.warnings.some((w) => w.code === "PGVECTOR_FALLBACK"));
  });

  it("rejects when no searchIndexGenerationId is provided and no resolver exists (no SourceDocument side-effect)", async () => {
    const { deps, importCalls, getEnsureSourceDocsCalls } = makeDeps();
    const result = await runWorkerZipImportPipeline(
      baseInput({ deps, searchIndexGenerationId: undefined }),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, "SEARCH_GENERATION_REQUIRED");
    assert.equal(result.error?.retryable, false);
    // generation binding is checked BEFORE ensureSourceDocuments / importToDb
    assert.equal(getEnsureSourceDocsCalls(), 0);
    assert.equal(importCalls.length, 0);
  });

  it("uses the injected resolver to bind a generation when id is omitted", async () => {
    const { deps, importCalls } = makeDeps({
      resolveSearchIndexGenerationId: async () => "resolved-sig",
    });
    const result = await runWorkerZipImportPipeline(
      baseInput({ deps, searchIndexGenerationId: undefined }),
    );
    assert.equal(result.ok, true);
    assert.equal(result.searchIndexGenerationId, "resolved-sig");
    assert.equal(importCalls[0]?.searchIndexGenerationId, "resolved-sig");
  });

  it("does not mark ARCHIVE_STORED complete when the source ZIP upload fails", async () => {
    const { deps, stages } = makeDeps({
      storage: {
        putSmallObject: async (input) => {
          if (input.mimeType === "application/zip") {
            throw Object.assign(new Error("s3 down"), { code: "PAYLOAD_STORAGE_UNAVAILABLE" });
          }
          return { objectKey: input.objectKey ?? "k" };
        },
      },
    });
    const result = await runWorkerZipImportPipeline(baseInput({ deps }));
    assert.equal(result.ok, false);
    assert.equal(result.error?.stage, "ARCHIVE_STORED");
    assert.ok(!stages.includes("ARCHIVE_STORED"));
    assert.deepEqual(stages, ["ACCEPTED"]);
  });

  it("does not mark IMPORTED complete when the DB import fails", async () => {
    const { deps, stages } = makeDeps({
      importToDb: async () => {
        throw new WorkerOutputDbImportError("SEARCH_GENERATION_MISMATCH", "boom");
      },
    });
    const result = await runWorkerZipImportPipeline(baseInput({ deps }));
    assert.equal(result.ok, false);
    assert.ok(!stages.includes("IMPORTED"));
    assert.ok(stages.includes("WORKER_OUTPUT_STORED"));
  });

  it("rejects an oversized source ZIP before running the worker (non-retryable)", async () => {
    let workerCalled = false;
    const { deps, importCalls, getEnsureSourceDocsCalls } = makeDeps({
      getFileSize: () => 999,
      runWorker: async () => {
        workerCalled = true;
        return {
          ok: true,
          exitCode: 0,
          stdout: "",
          stderr: "",
          durationMs: 1,
          outputDir: "/tmp/fake",
        };
      },
    });
    const result = await runWorkerZipImportPipeline(
      baseInput({ deps, maxSourceZipUploadBytes: 500 }),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, "WORKER_ZIP_FILE_TOO_LARGE");
    assert.equal(result.error?.retryable, false);
    assert.equal(workerCalled, false);
    assert.equal(getEnsureSourceDocsCalls(), 0);
    assert.equal(importCalls.length, 0);
  });

  it("rejects an oversized worker output file before importing (non-retryable)", async () => {
    // source ZIP is small, but a worker output file exceeds the per-file limit.
    let calls = 0;
    const { deps, importCalls } = makeDeps({
      getFileSize: () => {
        calls += 1;
        // first call = source ZIP (small), later = worker output (large)
        return calls === 1 ? 10 : 999;
      },
    });
    const result = await runWorkerZipImportPipeline(
      baseInput({ deps, maxWorkerOutputUploadBytes: 500 }),
    );
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, "WORKER_OUTPUT_FILE_TOO_LARGE");
    assert.equal(result.error?.retryable, false);
    assert.equal(importCalls.length, 0);
  });
});

type FakeSourceDoc = { id: string; versionId: string; legacySourceType: string; checksum: string | null; fileName: string };

function makeSourceDocPrisma(seed: FakeSourceDoc[] = []) {
  const rows: FakeSourceDoc[] = [...seed];
  const createdData: Array<Record<string, unknown>> = [];
  let seq = 0;
  const client = {
    sourceDocument: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const found = rows.find(
          (r) =>
            r.versionId === where.versionId &&
            r.legacySourceType === where.legacySourceType &&
            (where.checksum !== undefined
              ? r.checksum === where.checksum
              : r.fileName === where.fileName),
        );
        return found ? { id: found.id } : null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createdData.push(data);
        const row: FakeSourceDoc = {
          id: `srcdoc-${++seq}`,
          versionId: data.versionId as string,
          legacySourceType: data.legacySourceType as string,
          checksum: (data.checksum as string | null) ?? null,
          fileName: data.fileName as string,
        };
        rows.push(row);
        return { id: row.id };
      },
    },
  };
  return { client, createdData, rows };
}

describe("ensureWorkerSourceDocuments (P5)", () => {
  it("creates a SourceDocument per normalized document and returns the mapping", async () => {
    const { client, createdData } = makeSourceDocPrisma();
    const mapping = await ensureWorkerSourceDocuments({
      payload: makePayload(),
      productVersion: "1.0.0",
      prismaClient: client as never,
    });
    assert.equal(Object.keys(mapping).length, 1);
    assert.equal(mapping["Docs/a.html"], "srcdoc-1");
    assert.equal(createdData[0]?.versionId, "ver1");
    assert.equal(createdData[0]?.legacySourceType, WORKER_ZIP_SOURCE_LEGACY_TYPE);
    assert.equal(createdData[0]?.checksum, "sha-a");
    assert.equal(createdData[0]?.fileName, "a.html");
  });

  it("reuses an existing SourceDocument (idempotent re-run) by checksum", async () => {
    const { client, createdData } = makeSourceDocPrisma([
      {
        id: "existing-1",
        versionId: "ver1",
        legacySourceType: WORKER_ZIP_SOURCE_LEGACY_TYPE,
        checksum: "sha-a",
        fileName: "a.html",
      },
    ]);
    const mapping = await ensureWorkerSourceDocuments({
      payload: makePayload(),
      prismaClient: client as never,
    });
    assert.equal(mapping["Docs/a.html"], "existing-1");
    assert.equal(createdData.length, 0);
  });
});
