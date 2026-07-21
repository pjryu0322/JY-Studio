import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  IMPORT_CHANNELS,
  mapWorkerZipStageToPipelineStatus,
  type WorkerOutputImportPayload,
} from "../lib/python-worker/index.ts";
import {
  computeWorkerZipNormalizedDocumentFingerprint,
  deriveWorkerZipEmbeddingDescriptor,
  synthesizeWorkerZipSearchGeneration,
  WORKER_ZIP_ADAPTER_TYPE,
  WorkerZipGenerationBridgeError,
} from "../lib/python-worker/worker-zip-generation-bridge.ts";
import {
  mapWorkerZipFailureCode,
  runProviderWorkerZipImport,
  WorkerZipImportServiceError,
  type WorkerZipGenerationTransitions,
} from "../lib/python-worker/worker-zip-import-provider-service.ts";

function makePayload(overrides?: Partial<WorkerOutputImportPayload>): WorkerOutputImportPayload {
  return {
    importChannel: IMPORT_CHANNELS.WORKER_ZIP_IMPORT,
    regenerateChunks: false,
    packId: "packA",
    packVersionId: "verA",
    pipelineRunId: "run1",
    parserVersion: "0.1.0",
    sourceZip: { objectKey: "k" },
    storedFiles: [],
    chunks: [{ chunkId: "c1", content: "x", sourcePath: "a.md", traceId: "t1" }],
    embeddings: [
      {
        chunkId: "c1",
        provider: "local-e5",
        model: "e5-small",
        dimension: 3,
        vector: [0.1, 0.2, 0.3],
        contentHash: "h1",
      },
    ],
    sourceTraces: [],
    normalizedDocuments: [{ documentId: "d1", sourcePath: "a.md", sourceType: "md", title: "A" }],
    inventory: [],
    validationReport: { status: "ok", errors: [], warnings: [] },
    pipelineStatusAfterImport: mapWorkerZipStageToPipelineStatus("IMPORTED"),
    logicalStage: "IMPORTED",
    warnings: [],
    ...overrides,
  };
}

describe("worker-zip generation bridge (P7)", () => {
  it("derives the embedding descriptor from worker embeddings (no re-embedding)", () => {
    const descriptor = deriveWorkerZipEmbeddingDescriptor(makePayload());
    assert.equal(descriptor.embeddingProvider, "local-e5");
    assert.equal(descriptor.embeddingModel, "e5-small");
    assert.equal(descriptor.embeddingDimension, 3);
    assert.equal(descriptor.distanceMetric, "cosine");
    // No modelRevision on the embedding → falls back to the legacy marker.
    assert.equal(descriptor.embeddingModelRevision, "legacy-unknown");
  });

  it("throws when there are no embeddings", () => {
    assert.throws(
      () => deriveWorkerZipEmbeddingDescriptor(makePayload({ embeddings: [] })),
      (e: unknown) =>
        e instanceof WorkerZipGenerationBridgeError && e.code === "WORKER_ZIP_EMPTY_EMBEDDINGS",
    );
  });

  it("throws when embeddings use inconsistent descriptors", () => {
    const payload = makePayload({
      embeddings: [
        { chunkId: "c1", provider: "local-e5", model: "e5-small", dimension: 3, vector: [1], contentHash: "h1" },
        { chunkId: "c2", provider: "local-e5", model: "other", dimension: 3, vector: [1], contentHash: "h2" },
      ],
    });
    assert.throws(
      () => deriveWorkerZipEmbeddingDescriptor(payload),
      (e: unknown) =>
        e instanceof WorkerZipGenerationBridgeError && e.code === "WORKER_ZIP_INCONSISTENT_EMBEDDINGS",
    );
  });

  it("computes a deterministic, content-derived fingerprint", () => {
    const a = computeWorkerZipNormalizedDocumentFingerprint(makePayload());
    const b = computeWorkerZipNormalizedDocumentFingerprint(makePayload());
    assert.equal(a, b);
    assert.ok(a.startsWith("worker-zip-"));
    const changed = computeWorkerZipNormalizedDocumentFingerprint(
      makePayload({ embeddings: [{ chunkId: "c1", provider: "local-e5", model: "e5-small", dimension: 3, vector: [1], contentHash: "DIFFERENT" }] }),
    );
    assert.notEqual(a, changed);
  });

  it("synthesizes a hidden WORKER_ZIP bundle + ND, then creates the generation", async () => {
    let bundleData: Record<string, unknown> | null = null;
    let ndData: Record<string, unknown> | null = null;
    let genArgs: Record<string, unknown> | null = null;

    const tx = {
      doclingImportBundle: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          bundleData = data;
          return { id: "bundle-1" };
        },
      },
      normalizedDocument: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          ndData = data;
          return { id: "nd-1" };
        },
      },
    };
    const fakePrisma = { $transaction: async (cb: (c: unknown) => unknown) => cb(tx) };

    const result = await synthesizeWorkerZipSearchGeneration({
      generationId: "gen-1",
      payload: makePayload(),
      pipelineRunId: "run1",
      prismaClient: fakePrisma as never,
      createGeneration: (async (args: Record<string, unknown>) => {
        genArgs = args;
        return { id: args.id };
      }) as never,
    });

    assert.equal(result.searchIndexGenerationId, "gen-1");
    assert.equal(result.bundleId, "bundle-1");
    assert.equal(result.normalizedDocumentId, "nd-1");

    // Compatibility bridge markers: identifiable as WORKER_ZIP and hidden from Docling flows.
    assert.equal(bundleData!.adapterType, WORKER_ZIP_ADAPTER_TYPE);
    assert.equal(bundleData!.isActive, false);
    assert.ok(bundleData!.deletedAt instanceof Date);
    assert.equal(bundleData!.stagingReason, "worker_zip_bridge");
    assert.equal(ndData!.adapterType, WORKER_ZIP_ADAPTER_TYPE);
    assert.equal(ndData!.isActive, false);

    // Generation is bound to the synthesized ND and the caller-provided id.
    assert.equal(genArgs!.id, "gen-1");
    assert.equal(genArgs!.chunkGenerationId, "gen-1");
    assert.equal(genArgs!.normalizedDocumentId, "nd-1");
    assert.ok(genArgs!.descriptor);
  });
});

type ServiceHarness = {
  transitionCalls: string[];
  pipelineRunUpdates: Record<string, unknown>[];
  synthCalledWith: string[];
};

function makeServicePrisma(
  harness: ServiceHarness,
  packOverride?: { status?: string } | null,
) {
  return {
    knowledgePack: {
      findFirst: async () =>
        packOverride === null
          ? null
          : {
              packId: "packA",
              name: "Pack A",
              status: packOverride?.status ?? "DRAFT",
              versions: [{ id: "verA", version: "1.0.0", language: "KO" }],
            },
    },
    pipelineRun: {
      create: async () => ({ id: "prun-1" }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        harness.pipelineRunUpdates.push(data);
        return {};
      },
    },
  } as never;
}

function makeTransitions(harness: ServiceHarness): WorkerZipGenerationTransitions {
  return {
    toEmbedding: async () => harness.transitionCalls.push("EMBEDDING"),
    toIndexing: async () => harness.transitionCalls.push("INDEXING"),
    toReady: async () => harness.transitionCalls.push("READY"),
    toFailed: async () => harness.transitionCalls.push("FAILED"),
  };
}

function okPipelineResult(searchIndexGenerationId: string) {
  return {
    ok: true as const,
    logicalStage: "IMPORTED" as const,
    pipelineStatus: mapWorkerZipStageToPipelineStatus("IMPORTED"),
    sourceZipObjectKey: "k",
    storedObjectKeys: [],
    searchIndexGenerationId,
    chunkGenerationId: searchIndexGenerationId,
    importedChunkCount: 3,
    importedEmbeddingCount: 3,
    pgvectorReflected: true,
    vectorUpsertedCount: 3,
    vectorSkippedCount: 0,
    warnings: [],
  };
}

describe("runProviderWorkerZipImport (P7 synchronous)", () => {
  it("happy path: preps generation via bridge, imports, marks READY, PASS", async () => {
    const harness: ServiceHarness = { transitionCalls: [], pipelineRunUpdates: [], synthCalledWith: [] };
    let resolvedGenerationId = "";

    const result = await runProviderWorkerZipImport({
      userId: "u1",
      clientId: "cl1",
      packId: "packA",
      inputZipPath: "/tmp/x.zip",
      prismaClient: makeServicePrisma(harness),
      findProfile: async () => ({ id: "prof-1" }),
      transitions: makeTransitions(harness),
      synthesizeGeneration: (async ({ generationId }: { generationId: string }) => {
        harness.synthCalledWith.push(generationId);
        return { searchIndexGenerationId: generationId, bundleId: "b", normalizedDocumentId: "n" };
      }) as never,
      runPipeline: (async (input: {
        deps: { resolveSearchIndexGenerationId: (ctx: unknown) => Promise<string> };
      }) => {
        resolvedGenerationId = await input.deps.resolveSearchIndexGenerationId({
          payload: makePayload(),
          packId: "packA",
          packVersionId: "verA",
          pipelineRunId: "prun-1",
        });
        return okPipelineResult(resolvedGenerationId);
      }) as never,
    });

    assert.equal(result.ok, true);
    assert.equal(result.nextStep, "SEARCH_DATA_VALIDATION");
    assert.equal(result.generationReady, true);
    assert.equal(result.importedChunkCount, 3);
    assert.equal(result.searchIndexGenerationId, resolvedGenerationId);
    // The bridge used the caller-pre-generated id (so failures can be marked later).
    assert.deepEqual(harness.synthCalledWith, [resolvedGenerationId]);
    assert.deepEqual(harness.transitionCalls, ["EMBEDDING", "INDEXING", "READY"]);
    assert.equal(harness.pipelineRunUpdates.at(-1)?.status, "PASS");
  });

  it("failure after generation created: marks FAILED + FAIL, maps user error", async () => {
    const harness: ServiceHarness = { transitionCalls: [], pipelineRunUpdates: [], synthCalledWith: [] };

    const result = await runProviderWorkerZipImport({
      userId: "u1",
      clientId: "cl1",
      packId: "packA",
      inputZipPath: "/tmp/x.zip",
      prismaClient: makeServicePrisma(harness),
      findProfile: async () => ({ id: "prof-1" }),
      transitions: makeTransitions(harness),
      synthesizeGeneration: (async ({ generationId }: { generationId: string }) => {
        harness.synthCalledWith.push(generationId);
        return { searchIndexGenerationId: generationId, bundleId: "b", normalizedDocumentId: "n" };
      }) as never,
      runPipeline: (async (input: {
        deps: { resolveSearchIndexGenerationId: (ctx: unknown) => Promise<string> };
      }) => {
        await input.deps.resolveSearchIndexGenerationId({
          payload: makePayload(),
          packId: "packA",
          packVersionId: "verA",
          pipelineRunId: "prun-1",
        });
        return {
          ok: false as const,
          logicalStage: "IMPORTED" as const,
          pipelineStatus: mapWorkerZipStageToPipelineStatus("IMPORTED"),
          sourceZipObjectKey: "k",
          storedObjectKeys: [],
          importedChunkCount: 0,
          importedEmbeddingCount: 0,
          pgvectorReflected: false,
          vectorUpsertedCount: 0,
          vectorSkippedCount: 0,
          warnings: [],
          error: {
            code: "SEARCH_GENERATION_DESCRIPTOR_MISMATCH",
            message: "raw internal detail",
            retryable: false,
            stage: "IMPORTED" as const,
          },
        };
      }) as never,
    });

    assert.equal(result.ok, false);
    assert.equal(result.nextStep, "RETRY");
    assert.equal(result.error?.code, "SEARCH_GENERATION_DESCRIPTOR_MISMATCH");
    assert.equal(result.error?.supportRequired, true);
    // User-facing message must not leak the raw internal detail.
    assert.equal(/raw internal detail/.test(result.error?.message ?? ""), false);
    assert.ok(harness.transitionCalls.includes("FAILED"));
    assert.equal(harness.pipelineRunUpdates.at(-1)?.status, "FAIL");
  });

  it("failure before generation created: does not mark generation FAILED", async () => {
    const harness: ServiceHarness = { transitionCalls: [], pipelineRunUpdates: [], synthCalledWith: [] };

    const result = await runProviderWorkerZipImport({
      userId: "u1",
      clientId: "cl1",
      packId: "packA",
      inputZipPath: "/tmp/x.zip",
      prismaClient: makeServicePrisma(harness),
      findProfile: async () => ({ id: "prof-1" }),
      transitions: makeTransitions(harness),
      synthesizeGeneration: (async () => {
        throw new Error("should not be called");
      }) as never,
      runPipeline: (async () => ({
        ok: false as const,
        logicalStage: "WORKER_RUNNING" as const,
        pipelineStatus: mapWorkerZipStageToPipelineStatus("WORKER_RUNNING"),
        sourceZipObjectKey: "k",
        storedObjectKeys: [],
        importedChunkCount: 0,
        importedEmbeddingCount: 0,
        pgvectorReflected: false,
        vectorUpsertedCount: 0,
        vectorSkippedCount: 0,
        warnings: [],
        error: { code: "WORKER_RUN_FAILED", message: "x", retryable: false, stage: "WORKER_RUNNING" as const },
      })) as never,
    });

    assert.equal(result.ok, false);
    assert.equal(result.searchIndexGenerationId, undefined);
    assert.equal(harness.synthCalledWith.length, 0);
    assert.ok(!harness.transitionCalls.includes("FAILED"));
  });

  it("rejects a pack that is not found", async () => {
    const harness: ServiceHarness = { transitionCalls: [], pipelineRunUpdates: [], synthCalledWith: [] };
    await assert.rejects(
      () =>
        runProviderWorkerZipImport({
          userId: "u1",
          clientId: "cl1",
          packId: "packA",
          inputZipPath: "/tmp/x.zip",
          prismaClient: makeServicePrisma(harness, null),
          findProfile: async () => ({ id: "prof-1" }),
        }),
      (err: unknown) =>
        err instanceof WorkerZipImportServiceError && err.code === "NOT_FOUND" && err.httpStatus === 404,
    );
  });

  it("rejects a non-DRAFT pack", async () => {
    const harness: ServiceHarness = { transitionCalls: [], pipelineRunUpdates: [], synthCalledWith: [] };
    await assert.rejects(
      () =>
        runProviderWorkerZipImport({
          userId: "u1",
          clientId: "cl1",
          packId: "packA",
          inputZipPath: "/tmp/x.zip",
          prismaClient: makeServicePrisma(harness, { status: "IN_REVIEW" }),
          findProfile: async () => ({ id: "prof-1" }),
        }),
      (err: unknown) =>
        err instanceof WorkerZipImportServiceError && err.code === "PACK_NOT_EDITABLE",
    );
  });
});

function readSrc(relFromSrc: string): string {
  return readFileSync(path.join(process.cwd(), "src", relFromSrc), "utf8");
}

describe("worker-zip route + UI wiring (P7 source contracts)", () => {
  it("route authenticates, validates .zip + size, and awaits the service synchronously", () => {
    const src = readSrc("app/api/v1/provider/packs/[packId]/worker-zip/route.ts");
    assert.match(src, /requireProviderApiAuth/);
    assert.match(src, /runProviderWorkerZipImport/);
    assert.match(src, /withTempFileFromStream/);
    assert.match(src, /\.zip/);
    assert.match(src, /WORKER_ZIP_FILE_TOO_LARGE/);
    assert.match(src, /status:\s*413/);
  });

  it("bridge does not import the Docling ND knowledge builder (role separation)", () => {
    const src = readSrc("lib/python-worker/worker-zip-generation-bridge.ts");
    assert.ok(!/from\s+["']@\/lib\/docling-knowledge\/docling-nd-knowledge-builder/.test(src));
  });

  it("UI card is ZIP-only and calls the dedicated worker-zip API", () => {
    const src = readSrc("components/provider-distribution/ProviderWorkerZipImportCard.tsx");
    assert.match(src, /accept="\.zip"/);
    assert.match(src, /startProviderWorkerZipImportApi/);
    assert.match(src, /데이터 구조화 시작/);
  });

  it("material-registration tab mounts the ZIP card separately from Docling import", () => {
    const src = readSrc("components/provider-distribution/ProviderPayloadTab.tsx");
    assert.match(src, /ProviderWorkerZipImportCard/);
    assert.match(src, /ProviderDoclingImportTab/);
  });
});

describe("mapWorkerZipFailureCode (P7 safe copy)", () => {
  it("flags generation-prep failures as support-required", () => {
    assert.equal(mapWorkerZipFailureCode("SEARCH_GENERATION_REQUIRED").supportRequired, true);
  });
  it("keeps oversized-file failures self-serviceable", () => {
    assert.equal(mapWorkerZipFailureCode("WORKER_ZIP_FILE_TOO_LARGE").supportRequired, false);
  });
  it("defaults unknown codes to support-required", () => {
    assert.equal(mapWorkerZipFailureCode("SOMETHING_ELSE").supportRequired, true);
  });
});
