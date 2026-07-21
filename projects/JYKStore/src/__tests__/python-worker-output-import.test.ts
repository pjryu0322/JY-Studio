import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  IMPORT_CHANNELS,
  isLegacyDoclingImportChannel,
  isWorkerZipImportChannel,
  assertWorkerOutputImportable,
  buildWorkerOutputImportPlan,
  buildWorkerRunOutputObjectKey,
  buildWorkerRunSourceZipObjectKey,
  importWorkerOutputToStoreDb,
  mapWorkerZipStageToPipelineStatus,
  prepareWorkerOutputImport,
  validateWorkerOutputBundle,
  validateWorkerOutputDirectory,
  WORKER_RETRIEVAL_CHUNK_TYPE,
  WorkerOutputDbImportError,
  type WorkerEmbedding,
  type WorkerOutputBundle,
  type WorkerOutputImportPayload,
} from "../lib/python-worker/index.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function fixtureBundle(overrides?: Partial<WorkerOutputBundle>): WorkerOutputBundle {
  const base: WorkerOutputBundle = {
    inventory: [
      {
        sourcePath: "Docs/api/Grid.html",
        classification: "knowledge_target",
        sha256: "abc123",
        parser: "html_api",
      },
      {
        sourcePath: "LicenseKey/key.txt",
        classification: "excluded",
        sha256: "def456",
        parser: null,
        excludedReason: "license",
      },
      {
        sourcePath: "assets/logo.png",
        classification: "supporting_asset",
        sha256: "ghi789",
      },
    ],
    normalizedDocuments: [
      {
        documentId: "doc-grid",
        sourcePath: "Docs/api/Grid.html",
        sourceType: "html_api",
        title: "Grid",
        metadata: { parser: "html_api", parserVersion: "0.1.0" },
      },
    ],
    chunks: [
      {
        chunkId: "grid-section-001",
        title: "Grid",
        content: "Grid API overview",
        sourcePath: "Docs/api/Grid.html",
        section: "Overview",
        traceId: "trace-grid-section-001",
      },
    ],
    embeddings: [
      {
        chunkId: "grid-section-001",
        provider: "local",
        model: "e5-small",
        dimension: 3,
        vector: [0.1, 0.2, 0.3],
        contentHash: "hash-grid-001",
      },
    ],
    sourceTraces: [
      {
        traceId: "trace-grid-section-001",
        chunkId: "grid-section-001",
        sourcePath: "Docs/api/Grid.html",
        sourceHash: "abc123",
        parser: "html_api",
        parserVersion: "0.1.0",
      },
    ],
    validationReport: {
      status: "ok",
      errors: [],
      warnings: [],
      totals: { chunks: 1, documents: 1 },
    },
  };
  return { ...base, ...overrides };
}

function writeBundleDir(bundle: WorkerOutputBundle): string {
  const dir = mkdtempSync(path.join(tmpdir(), "jyk-worker-out-"));
  writeFileSync(path.join(dir, "inventory.json"), JSON.stringify(bundle.inventory), "utf8");
  writeFileSync(
    path.join(dir, "normalized_documents.json"),
    JSON.stringify(bundle.normalizedDocuments),
    "utf8",
  );
  writeFileSync(path.join(dir, "chunks.json"), JSON.stringify(bundle.chunks), "utf8");
  writeFileSync(path.join(dir, "embeddings.json"), JSON.stringify(bundle.embeddings), "utf8");
  writeFileSync(path.join(dir, "source_trace.json"), JSON.stringify(bundle.sourceTraces), "utf8");
  writeFileSync(
    path.join(dir, "validation_report.json"),
    JSON.stringify(bundle.validationReport),
    "utf8",
  );
  writeFileSync(path.join(dir, "normalized_documents.md"), "# review\n", "utf8");
  return dir;
}

describe("python worker output contract", () => {
  it("accepts a valid worker output bundle", () => {
    const result = validateWorkerOutputBundle(fixtureBundle());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.bundle.chunks.length, 1);
      assert.equal(result.bundle.chunks[0]?.traceId, "trace-grid-section-001");
    }
  });

  it("fails when chunk is missing traceId", () => {
    const bundle = fixtureBundle();
    // force missing traceId after construction
    const bad = {
      ...bundle,
      chunks: [
        {
          chunkId: "x",
          content: "c",
          sourcePath: "Docs/api/Grid.html",
          traceId: "",
        },
      ],
    };
    const dir = writeBundleDir(bad as WorkerOutputBundle);
    const result = validateWorkerOutputDirectory(dir);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(
        result.errors.some(
          (e) => e.code === "CHUNK_ENTRY" || e.code === "CHUNK_MISSING_TRACE_ID",
        ),
      );
    }
  });

  it("fails when chunk traceId is not in source_trace.json", () => {
    const bundle = fixtureBundle({
      chunks: [
        {
          chunkId: "orphan",
          content: "c",
          sourcePath: "Docs/api/Grid.html",
          traceId: "trace-missing",
        },
      ],
    });
    const result = validateWorkerOutputBundle(bundle);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.code === "CHUNK_TRACE_NOT_FOUND"));
    }
  });

  it("stops import when validation_report.errors is non-empty", () => {
    const bundle = fixtureBundle({
      validationReport: {
        status: "failed",
        errors: ["parser crashed on sample.pdf"],
      },
    });
    const result = validateWorkerOutputBundle(bundle);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.code === "VALIDATION_REPORT_HAS_ERRORS"));
    }
  });

  it("fails when excluded/supporting inventory paths appear in chunks", () => {
    const bundle = fixtureBundle({
      chunks: [
        {
          chunkId: "bad-excluded",
          content: "secret",
          sourcePath: "LicenseKey/key.txt",
          traceId: "trace-bad",
        },
      ],
      sourceTraces: [
        {
          traceId: "trace-bad",
          sourcePath: "LicenseKey/key.txt",
          sourceHash: "def456",
          parser: "none",
          parserVersion: "0.1.0",
        },
      ],
    });
    const result = validateWorkerOutputBundle(bundle);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.code === "CHUNK_FROM_NON_CHUNKABLE"));
    }
  });

  it("prepareWorkerOutputImport imports chunks as-is (regenerateChunks=false)", () => {
    const bundle = fixtureBundle();
    const dir = writeBundleDir(bundle);
    const prepared = prepareWorkerOutputImport({
      outputDir: dir,
      packId: "pack1",
      packVersionId: "ver1",
      pipelineRunId: "run1",
      objectStoragePrefix: "payloads",
    });
    assert.equal(prepared.ok, true);
    if (!prepared.ok) return;
    assert.equal(prepared.payload.regenerateChunks, false);
    assert.equal(prepared.payload.importChannel, IMPORT_CHANNELS.WORKER_ZIP_IMPORT);
    assert.deepEqual(prepared.payload.chunks, bundle.chunks);
    assert.equal(prepared.payload.chunks.length, 1);
    assert.equal(
      prepared.payload.sourceZip.objectKey,
      "payloads/packs/pack1/versions/ver1/runs/run1/source/original.zip",
    );
    const chunksKey = prepared.payload.storedFiles.find((f) => f.relativePath === "chunks.json");
    assert.ok(chunksKey?.present);
    assert.equal(
      chunksKey?.objectKey,
      "payloads/packs/pack1/versions/ver1/runs/run1/worker-output/chunks.json",
    );
    assert.ok(chunksKey!.sha256.length === 64);

    assert.equal(prepared.payload.embeddings.length, 1);
    assert.equal(prepared.payload.embeddings[0]?.chunkId, "grid-section-001");
    assert.deepEqual(prepared.payload.embeddings[0]?.vector, [0.1, 0.2, 0.3]);
    const embeddingsKey = prepared.payload.storedFiles.find(
      (f) => f.relativePath === "embeddings.json",
    );
    assert.ok(embeddingsKey?.present);
    assert.equal(embeddingsKey?.required, true);
    assert.equal(
      embeddingsKey?.objectKey,
      "payloads/packs/pack1/versions/ver1/runs/run1/worker-output/embeddings.json",
    );
    assert.equal(embeddingsKey!.sha256.length, 64);
  });

  it("fails when embeddings.json is missing", () => {
    const bundle = fixtureBundle();
    const dir = writeBundleDir(bundle);
    rmSync(path.join(dir, "embeddings.json"));
    const result = validateWorkerOutputDirectory(dir);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.code === "MISSING_FILE" && e.path === "embeddings.json"));
    }
  });

  it("fails when embedding references a non-existent chunk", () => {
    const bundle = fixtureBundle({
      embeddings: [
        {
          chunkId: "ghost-chunk",
          provider: "local",
          model: "e5-small",
          dimension: 3,
          vector: [0.1, 0.2, 0.3],
          contentHash: "hash-ghost",
        },
      ],
    });
    const result = validateWorkerOutputBundle(bundle);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.code === "EMBEDDING_CHUNK_NOT_FOUND"));
    }
  });

  it("fails when a chunk has no embedding", () => {
    const bundle = fixtureBundle({ embeddings: [] });
    const result = validateWorkerOutputBundle(bundle);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.code === "CHUNK_EMBEDDING_MISSING"));
    }
  });

  it("fails when vector length does not match dimension", () => {
    const bundle = fixtureBundle({
      embeddings: [
        {
          chunkId: "grid-section-001",
          provider: "local",
          model: "e5-small",
          dimension: 4,
          vector: [0.1, 0.2, 0.3],
          contentHash: "hash-grid-001",
        },
      ],
    });
    const result = validateWorkerOutputBundle(bundle);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.code === "EMBEDDING_VECTOR_DIMENSION_MISMATCH"));
    }
  });

  it("fails when a vector contains non-finite values", () => {
    for (const bad of [Infinity, -Infinity, NaN]) {
      const bundle = fixtureBundle({
        embeddings: [
          {
            chunkId: "grid-section-001",
            provider: "local",
            model: "e5-small",
            dimension: 3,
            vector: [0.1, bad, 0.3],
            contentHash: "hash-grid-001",
          },
        ],
      });
      const result = validateWorkerOutputBundle(bundle);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.ok(result.errors.some((e) => e.code === "EMBEDDING_VECTOR_NON_FINITE"));
      }
    }
  });

  it("fails when a vector is empty", () => {
    const bundle = fixtureBundle({
      embeddings: [
        {
          chunkId: "grid-section-001",
          provider: "local",
          model: "e5-small",
          dimension: 3,
          vector: [],
          contentHash: "hash-grid-001",
        },
      ],
    });
    const result = validateWorkerOutputBundle(bundle);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.code === "EMBEDDING_VECTOR_EMPTY"));
    }
  });

  it("fails when dimension is not a finite integer", () => {
    const dir = writeBundleDir(fixtureBundle());
    writeFileSync(
      path.join(dir, "embeddings.json"),
      JSON.stringify([
        {
          chunkId: "grid-section-001",
          provider: "local",
          model: "e5-small",
          dimension: 3.5,
          vector: [0.1, 0.2, 0.3],
          contentHash: "hash-grid-001",
        },
      ]),
      "utf8",
    );
    const result = validateWorkerOutputDirectory(dir);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.code === "EMBEDDING_ENTRY"));
    }
  });

  it("fails when the same chunk has duplicate embeddings", () => {
    const dup: WorkerEmbedding = {
      chunkId: "grid-section-001",
      provider: "local",
      model: "e5-small",
      dimension: 3,
      vector: [0.1, 0.2, 0.3],
      contentHash: "hash-grid-001",
    };
    const bundle = fixtureBundle({ embeddings: [dup, { ...dup }] });
    const result = validateWorkerOutputBundle(bundle);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.code === "EMBEDDING_DUPLICATE_CHUNK"));
    }
  });

  it("builds expected Object Storage keys", () => {
    const ctx = {
      prefix: "payloads",
      packId: "p",
      packVersionId: "v",
      pipelineRunId: "r",
    };
    assert.equal(
      buildWorkerRunSourceZipObjectKey(ctx),
      "payloads/packs/p/versions/v/runs/r/source/original.zip",
    );
    assert.equal(
      buildWorkerRunOutputObjectKey(ctx, "parser_artifacts/a.json"),
      "payloads/packs/p/versions/v/runs/r/worker-output/parser_artifacts/a.json",
    );
  });

  it("maps ZIP logical stages onto existing PipelineStatus without schema change", () => {
    assert.equal(mapWorkerZipStageToPipelineStatus("WORKER_RUNNING"), "STRUCTURING");
    assert.equal(mapWorkerZipStageToPipelineStatus("WORKER_OUTPUT_STORED"), "CHUNKING");
    assert.equal(mapWorkerZipStageToPipelineStatus("IMPORTED"), "CHUNK_EVALUATING");
    assert.equal(mapWorkerZipStageToPipelineStatus("APPROVED"), "APPROVED");
  });

  it("separates legacy Docling channel from worker_zip_import", () => {
    assert.equal(isWorkerZipImportChannel(IMPORT_CHANNELS.WORKER_ZIP_IMPORT), true);
    assert.equal(isLegacyDoclingImportChannel(IMPORT_CHANNELS.LEGACY_DOCLING_UPLOAD), true);
    assert.equal(isWorkerZipImportChannel(IMPORT_CHANNELS.LEGACY_DOCLING_UPLOAD), false);
  });

  it("does not call docling-nd-knowledge-builder from worker import module", () => {
    const importSrc = readFileSync(
      path.join(root, "src/lib/python-worker/worker-output-import-service.ts"),
      "utf8",
    );
    assert.ok(!/from\s+["']@\/lib\/docling-knowledge\/docling-nd-knowledge-builder/.test(importSrc));
    assert.ok(!importSrc.includes("buildKnowledgeFromNormalizedDocument"));
    assert.ok(importSrc.includes("regenerateChunks: false"));
    const builderSrc = readFileSync(
      path.join(root, "src/lib/docling-knowledge/docling-nd-knowledge-builder.ts"),
      "utf8",
    );
    assert.ok(builderSrc.includes("worker_zip_import"));
    assert.ok(builderSrc.includes("Do **not** call"));
  });

  it("legacy docling-import-service remains present and labeled", () => {
    const src = readFileSync(
      path.join(root, "src/lib/docling-import/docling-import-service.ts"),
      "utf8",
    );
    assert.ok(src.includes("legacy_docling_upload"));
    assert.ok(src.includes("worker_zip_import"));
    assert.ok(src.includes("validateAndNormalizeBundle") || src.length > 1000);
  });
});

function fixturePayload(
  overrides?: Partial<WorkerOutputImportPayload>,
  bundleOverrides?: Partial<WorkerOutputBundle>,
): WorkerOutputImportPayload {
  const bundle = fixtureBundle(bundleOverrides);
  return {
    importChannel: IMPORT_CHANNELS.WORKER_ZIP_IMPORT,
    regenerateChunks: false,
    packId: "pack1",
    packVersionId: "ver1",
    pipelineRunId: "run1",
    parserVersion: "0.1.0",
    sourceZip: { objectKey: "payloads/packs/pack1/versions/ver1/runs/run1/source/original.zip" },
    storedFiles: [],
    chunks: bundle.chunks,
    embeddings: bundle.embeddings,
    sourceTraces: bundle.sourceTraces,
    normalizedDocuments: bundle.normalizedDocuments,
    inventory: bundle.inventory,
    validationReport: bundle.validationReport,
    pipelineStatusAfterImport: mapWorkerZipStageToPipelineStatus("IMPORTED"),
    logicalStage: "IMPORTED",
    warnings: [],
    ...overrides,
  };
}

type FakePrismaCapture = {
  deletedChunkWheres: unknown[];
  deletedEmbeddingWheres: unknown[];
  chunks: Array<{ id: string; data: Record<string, unknown> }>;
  embeddings: Array<Record<string, unknown>>;
  generationUpdates: unknown[];
};

function makeFakePrisma(opts?: { generationExists?: boolean }) {
  const capture: FakePrismaCapture = {
    deletedChunkWheres: [],
    deletedEmbeddingWheres: [],
    chunks: [],
    embeddings: [],
    generationUpdates: [],
  };
  let seq = 0;
  const tx = {
    knowledgeChunk: {
      deleteMany: async ({ where }: { where: unknown }) => {
        capture.deletedChunkWheres.push(where);
        return { count: 0 };
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id = `chunk-db-${++seq}`;
        capture.chunks.push({ id, data });
        return { id };
      },
    },
    knowledgeChunkEmbedding: {
      deleteMany: async ({ where }: { where: unknown }) => {
        capture.deletedEmbeddingWheres.push(where);
        return { count: 0 };
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        capture.embeddings.push(data);
        return { id: `emb-db-${capture.embeddings.length}` };
      },
    },
    searchIndexGeneration: {
      findUnique: async () => (opts?.generationExists ? { id: "gen1" } : null),
      update: async (args: unknown) => {
        capture.generationUpdates.push(args);
        return {};
      },
    },
  };
  const client = {
    $transaction: async <T>(fn: (t: typeof tx) => Promise<T>): Promise<T> => fn(tx),
  };
  return { client, capture };
}

describe("python worker output DB import (P3)", () => {
  it("builds chunk/embedding create plans from a valid payload", () => {
    const plan = buildWorkerOutputImportPlan({
      payload: fixturePayload(),
      chunkGenerationId: "cg1",
      searchIndexGenerationId: "sig1",
    });
    assert.equal(plan.chunkPlans.length, 1);
    assert.equal(plan.chunkPlans[0]?.workerChunkId, "grid-section-001");
    assert.equal(plan.chunkPlans[0]?.data.chunkType, WORKER_RETRIEVAL_CHUNK_TYPE);
    assert.equal(plan.chunkPlans[0]?.data.versionId, "ver1");
    assert.equal(plan.chunkPlans[0]?.data.chunkGenerationId, "cg1");
    const meta = plan.chunkPlans[0]?.data.metadata as Record<string, unknown>;
    assert.equal(meta.importChannel, IMPORT_CHANNELS.WORKER_ZIP_IMPORT);
    assert.equal(meta.workerChunkId, "grid-section-001");
    assert.equal(plan.embeddingPlanByWorkerChunkId.size, 1);
    assert.equal(
      plan.embeddingPlanByWorkerChunkId.get("grid-section-001")?.contentHash,
      "hash-grid-001",
    );
  });

  it("persists chunks then embeddings mapped to created chunk ids", async () => {
    const { client, capture } = makeFakePrisma();
    const result = await importWorkerOutputToStoreDb({
      payload: fixturePayload(),
      chunkGenerationId: "cg1",
      searchIndexGenerationId: "sig1",
      prismaClient: client as never,
    });
    assert.equal(result.importedChunkCount, 1);
    assert.equal(result.importedEmbeddingCount, 1);
    assert.equal(capture.chunks.length, 1);
    assert.equal(capture.embeddings.length, 1);
    const createdChunkId = capture.chunks[0]?.id;
    assert.equal(result.chunkIdByWorkerChunkId["grid-section-001"], createdChunkId);
    // embedding.chunkId must be the created KnowledgeChunk.id, not the worker chunkId
    assert.equal(capture.embeddings[0]?.chunkId, createdChunkId);
    assert.notEqual(capture.embeddings[0]?.chunkId, "grid-section-001");
    assert.equal(capture.embeddings[0]?.searchIndexGenerationId, "sig1");
  });

  it("clears the same chunkGeneration before reinserting (re-run policy)", async () => {
    const { client, capture } = makeFakePrisma();
    await importWorkerOutputToStoreDb({
      payload: fixturePayload(),
      chunkGenerationId: "cg1",
      prismaClient: client as never,
    });
    assert.equal(capture.deletedChunkWheres.length, 1);
    assert.deepEqual(capture.deletedChunkWheres[0], {
      versionId: "ver1",
      chunkGenerationId: "cg1",
    });
  });

  it("updates generation counts when the generation exists", async () => {
    const { client, capture } = makeFakePrisma({ generationExists: true });
    await importWorkerOutputToStoreDb({
      payload: fixturePayload(),
      searchIndexGenerationId: "sig1",
      prismaClient: client as never,
    });
    assert.equal(capture.generationUpdates.length, 1);
  });

  it("rejects when validation_report has errors", async () => {
    const payload = fixturePayload(undefined, {
      validationReport: { status: "ok", errors: ["boom"], warnings: [] },
    });
    await assert.rejects(
      () => importWorkerOutputToStoreDb({ payload, prismaClient: makeFakePrisma().client as never }),
      (e) => e instanceof WorkerOutputDbImportError && e.code === "VALIDATION_REPORT_HAS_ERRORS",
    );
  });

  it("rejects when validation status is partial", async () => {
    const payload = fixturePayload(undefined, {
      validationReport: { status: "partial", errors: [], warnings: [] },
    });
    await assert.rejects(
      () => importWorkerOutputToStoreDb({ payload, prismaClient: makeFakePrisma().client as never }),
      (e) => e instanceof WorkerOutputDbImportError && e.code === "VALIDATION_STATUS_NOT_OK",
    );
  });

  it("rejects when chunk and embedding counts differ", () => {
    const payload = fixturePayload({ embeddings: [] });
    assert.throws(
      () => assertWorkerOutputImportable(payload),
      (e) => e instanceof WorkerOutputDbImportError && e.code === "CHUNK_EMBEDDING_COUNT_MISMATCH",
    );
  });

  it("rejects when an embedding references a missing chunk", () => {
    const payload = fixturePayload({
      embeddings: [
        {
          chunkId: "ghost",
          provider: "local",
          model: "e5-small",
          dimension: 3,
          vector: [0.1, 0.2, 0.3],
          contentHash: "h",
        },
      ],
    });
    assert.throws(
      () => assertWorkerOutputImportable(payload),
      (e) => e instanceof WorkerOutputDbImportError && e.code === "EMBEDDING_CHUNK_NOT_FOUND",
    );
  });

  it("rejects when requirePgvector is set (deferred to P4)", async () => {
    await assert.rejects(
      () =>
        importWorkerOutputToStoreDb({
          payload: fixturePayload(),
          requirePgvector: true,
          prismaClient: makeFakePrisma().client as never,
        }),
      (e) =>
        e instanceof WorkerOutputDbImportError &&
        e.code === "PGVECTOR_REFLECTION_NOT_IMPLEMENTED",
    );
  });

  it("does not call docling-nd-knowledge-builder from the DB import service", () => {
    const src = readFileSync(
      path.join(root, "src/lib/python-worker/worker-output-db-import-service.ts"),
      "utf8",
    );
    assert.ok(!/from\s+["']@\/lib\/docling-knowledge\/docling-nd-knowledge-builder/.test(src));
    assert.ok(!src.includes("buildKnowledgeFromNormalizedDocument"));
  });
});
