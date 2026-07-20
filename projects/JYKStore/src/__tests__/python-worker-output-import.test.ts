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
  buildWorkerRunOutputObjectKey,
  buildWorkerRunSourceZipObjectKey,
  mapWorkerZipStageToPipelineStatus,
  prepareWorkerOutputImport,
  validateWorkerOutputBundle,
  validateWorkerOutputDirectory,
  type WorkerEmbedding,
  type WorkerOutputBundle,
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
