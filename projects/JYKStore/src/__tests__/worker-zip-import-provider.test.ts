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
import {
  checkWorkerZipContentLength,
  mapWorkerZipImportHttpResponse,
  MAX_WORKER_ZIP_UPLOAD_BYTES,
  validateWorkerZipFile,
} from "../lib/python-worker/worker-zip-route-helpers.ts";
import { isStagingVisibleDoclingBundle } from "../lib/docling-import/docling-import-lifecycle-service.ts";

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
    assert.equal((ndData!.structureSummaryJson as { source?: string }).source, "worker_zip_bridge");

    // Generation is bound to the synthesized ND and the caller-provided id.
    assert.equal(genArgs!.id, "gen-1");
    assert.equal(genArgs!.chunkGenerationId, "gen-1");
    assert.equal(genArgs!.normalizedDocumentId, "nd-1");
    assert.ok(genArgs!.descriptor);
    // P7.1.1: the DB allows one active DRAFT per version, so the bridge must NOT
    // pass stalePreviousDrafts=false (that would collide with an existing READY
    // DRAFT). It relies on the default stale-at-creation policy.
    assert.notEqual(genArgs!.stalePreviousDrafts, false);
  });

  it("bridge bundle is excluded from the Docling staging-visibility predicate", async () => {
    let bundleData: Record<string, unknown> | null = null;
    const tx = {
      doclingImportBundle: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          bundleData = data;
          return { id: "bundle-1" };
        },
      },
      normalizedDocument: { create: async () => ({ id: "nd-1" }) },
    };
    await synthesizeWorkerZipSearchGeneration({
      generationId: "gen-1",
      payload: makePayload(),
      pipelineRunId: "run1",
      prismaClient: { $transaction: async (cb: (c: unknown) => unknown) => cb(tx) } as never,
      createGeneration: (async (args: Record<string, unknown>) => ({ id: args.id })) as never,
    });

    // Reconstruct the stored row (storageStatus defaults to ACTIVE in the schema).
    const storedBundle = {
      isActive: bundleData!.isActive as boolean,
      deletedAt: bundleData!.deletedAt as Date | null,
      storageStatus: "ACTIVE" as never,
      status: bundleData!.status as never,
    };
    assert.equal(isStagingVisibleDoclingBundle(storedBundle), false);
    // Sanity: a genuine Docling staging bundle (no deletedAt) IS visible.
    assert.equal(
      isStagingVisibleDoclingBundle({ ...storedBundle, deletedAt: null, status: "UPLOADED" as never }),
      true,
    );
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

function makeTransitions(
  harness: ServiceHarness,
  overrides?: Partial<WorkerZipGenerationTransitions>,
): WorkerZipGenerationTransitions {
  return {
    toEmbedding: async () => harness.transitionCalls.push("EMBEDDING"),
    toIndexing: async () => harness.transitionCalls.push("INDEXING"),
    toReady: async () => harness.transitionCalls.push("READY"),
    toFailed: async () => harness.transitionCalls.push("FAILED"),
    ...overrides,
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
    // P7.1.1: prior active DRAFTs are retired at generation-creation time (the DB
    // allows one active DRAFT per version), so no separate post-READY stale step.
    assert.deepEqual(harness.transitionCalls, ["EMBEDDING", "INDEXING", "READY"]);
    assert.equal(harness.pipelineRunUpdates.at(-1)?.status, "PASS");
  });

  it("READY-transition failure: ok=false, RETRY, generationReady=false, run FAIL", async () => {
    const harness: ServiceHarness = { transitionCalls: [], pipelineRunUpdates: [], synthCalledWith: [] };

    const result = await runProviderWorkerZipImport({
      userId: "u1",
      clientId: "cl1",
      packId: "packA",
      inputZipPath: "/tmp/x.zip",
      prismaClient: makeServicePrisma(harness),
      findProfile: async () => ({ id: "prof-1" }),
      transitions: makeTransitions(harness, {
        toReady: async () => {
          harness.transitionCalls.push("READY_FAIL");
          throw new Error("count mismatch internal detail");
        },
      }),
      synthesizeGeneration: (async ({ generationId }: { generationId: string }) => {
        harness.synthCalledWith.push(generationId);
        return { searchIndexGenerationId: generationId, bundleId: "b", normalizedDocumentId: "n" };
      }) as never,
      runPipeline: (async (input: {
        deps: { resolveSearchIndexGenerationId: (ctx: unknown) => Promise<string> };
      }) => {
        const gid = await input.deps.resolveSearchIndexGenerationId({
          payload: makePayload(),
          packId: "packA",
          packVersionId: "verA",
          pipelineRunId: "prun-1",
        });
        return okPipelineResult(gid);
      }) as never,
    });

    assert.equal(result.ok, false);
    assert.equal(result.generationReady, false);
    assert.equal(result.nextStep, "RETRY");
    assert.equal(result.error?.code, "GENERATION_READY_DEFERRED");
    assert.equal(result.error?.supportRequired, true);
    // Import counts are preserved for diagnostics.
    assert.equal(result.importedChunkCount, 3);
    assert.equal(result.importedEmbeddingCount, 3);
    // Raw internal detail must not leak.
    assert.equal(/count mismatch internal detail/.test(result.error?.message ?? ""), false);
    // P7.1.1: run is recorded as FAIL (a valid PipelineStepStatus), never WARNING.
    assert.equal(harness.pipelineRunUpdates.at(-1)?.status, "FAIL");
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
  it("route authenticates, guards content-length before formData, and awaits the service", () => {
    const src = readSrc("app/api/v1/provider/packs/[packId]/worker-zip/route.ts");
    assert.match(src, /requireProviderApiAuth/);
    assert.match(src, /runProviderWorkerZipImport/);
    assert.match(src, /withTempFileFromStream/);
    assert.match(src, /mapWorkerZipImportHttpResponse/);
    // P7.1: content-length guard must run before request.formData().
    const clIdx = src.indexOf("checkWorkerZipContentLength");
    const fdIdx = src.indexOf("request.formData()");
    assert.ok(clIdx >= 0 && fdIdx >= 0 && clIdx < fdIdx);
  });

  it("bridge does not import the Docling ND knowledge builder (role separation)", () => {
    const src = readSrc("lib/python-worker/worker-zip-generation-bridge.ts");
    assert.ok(!/from\s+["']@\/lib\/docling-knowledge\/docling-nd-knowledge-builder/.test(src));
  });

  it("provider service does not import the legacy Docling upload session service", () => {
    const src = readSrc("lib/python-worker/worker-zip-import-provider-service.ts");
    assert.ok(!/from\s+["']@\/lib\/docling-import\/docling-upload-session-service/.test(src));
    assert.ok(!/from\s+["']@\/lib\/docling-knowledge\/docling-nd-knowledge-builder/.test(src));
  });

  it("ProviderDoclingImportTab does not call the worker-zip API", () => {
    const src = readSrc("components/provider-distribution/ProviderDoclingImportTab.tsx");
    assert.ok(!/startProviderWorkerZipImportApi/.test(src));
    assert.ok(!/worker-zip/.test(src));
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
  it("flags deferred readiness as support-required (not completed)", () => {
    const mapped = mapWorkerZipFailureCode("GENERATION_READY_DEFERRED");
    assert.equal(mapped.supportRequired, true);
    assert.match(mapped.message, /지연/);
  });
  it("defaults unknown codes to support-required", () => {
    assert.equal(mapWorkerZipFailureCode("SOMETHING_ELSE").supportRequired, true);
  });
});

describe("worker-zip route helpers (P7.1 behavior)", () => {
  it("rejects by content-length before parsing when over the limit", () => {
    const rejection = checkWorkerZipContentLength(String(MAX_WORKER_ZIP_UPLOAD_BYTES + 1));
    assert.ok(rejection);
    assert.equal(rejection!.status, 413);
    assert.equal(rejection!.code, "WORKER_ZIP_FILE_TOO_LARGE");
  });
  it("passes content-length within the limit / missing / non-numeric", () => {
    assert.equal(checkWorkerZipContentLength(String(1024)), null);
    assert.equal(checkWorkerZipContentLength(null), null);
    assert.equal(checkWorkerZipContentLength("not-a-number"), null);
  });
  it("validates the uploaded file (missing / non-zip / oversize / ok)", () => {
    assert.equal(validateWorkerZipFile(null)?.code, "FILE_REQUIRED");
    assert.equal(validateWorkerZipFile({ name: "a.txt", size: 10 })?.code, "INVALID_FILE_TYPE");
    assert.equal(
      validateWorkerZipFile({ name: "a.zip", size: MAX_WORKER_ZIP_UPLOAD_BYTES + 1 })?.code,
      "WORKER_ZIP_FILE_TOO_LARGE",
    );
    assert.equal(validateWorkerZipFile({ name: "a.zip", size: 10 }), null);
    assert.equal(validateWorkerZipFile({ name: "A.ZIP", size: 10 }), null);
  });
  it("maps ok results to 200 and processed-but-failed results to 422", () => {
    assert.equal(
      mapWorkerZipImportHttpResponse({ ok: true } as never).status,
      200,
    );
    assert.equal(
      mapWorkerZipImportHttpResponse({ ok: false } as never).status,
      422,
    );
  });
});
