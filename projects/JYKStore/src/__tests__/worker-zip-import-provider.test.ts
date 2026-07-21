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
  acceptAdminWorkerZipRequest,
  getProviderWorkerZipRequestState,
  listAdminWorkerZipRequests,
  mapWorkerZipFailureCode,
  runAdminWorkerZipGeneration,
  runProviderWorkerZipImport,
  submitProviderWorkerZipRequest,
  withdrawProviderWorkerZipRequest,
  WORKER_ZIP_REQUEST_ACCEPTED_STATUS,
  WORKER_ZIP_REQUEST_TRIGGER,
  WorkerZipImportServiceError,
  type WorkerZipGenerationTransitions,
} from "../lib/python-worker/worker-zip-import-provider-service.ts";
import {
  checkWorkerZipContentLength,
  mapWorkerZipImportHttpResponse,
  MAX_WORKER_ZIP_UPLOAD_BYTES,
  validateWorkerZipFile,
} from "../lib/python-worker/worker-zip-route-helpers.ts";
import { readWorkerExclusionSummary } from "../lib/python-worker/worker-output-contract.ts";
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

describe("worker-zip routes + UI wiring (P7.3 source contracts)", () => {
  it("provider route is store-only (request, not execution)", () => {
    const src = readSrc("app/api/v1/provider/packs/[packId]/worker-zip/route.ts");
    assert.match(src, /requireProviderApiAuth/);
    assert.match(src, /submitProviderWorkerZipRequest/);
    assert.match(src, /getProviderWorkerZipRequestState/);
    // 요청 회수(withdraw) must be available to the Provider while 접수 대기.
    assert.match(src, /export async function DELETE/);
    assert.match(src, /withdrawProviderWorkerZipRequest/);
    // The Provider route must NOT execute the Worker (execution is Admin-only).
    assert.ok(!/runProviderWorkerZipImport|runAdminWorkerZipGeneration/.test(src));
    // P7.1: content-length guard must still run before request.formData().
    const clIdx = src.indexOf("checkWorkerZipContentLength");
    const fdIdx = src.indexOf("request.formData()");
    assert.ok(clIdx >= 0 && fdIdx >= 0 && clIdx < fdIdx);
  });

  it("admin route gates execution to admins and runs the worker", () => {
    const src = readSrc("app/api/v1/admin/packs/[packId]/worker-zip/route.ts");
    assert.match(src, /requireAdminSession/);
    assert.match(src, /runAdminWorkerZipGeneration/);
    assert.match(src, /resolveAdminDraftPack/);
    // 접수(accept) is available via PATCH so the request becomes 접수완료.
    assert.match(src, /export async function PATCH/);
    assert.match(src, /acceptAdminWorkerZipRequest/);
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
    assert.ok(!/requestProviderWorkerZipGenerationApi/.test(src));
    assert.ok(!/worker-zip/.test(src));
  });

  it("provider ZIP card is request-only (no worker execution)", () => {
    const src = readSrc("components/provider-distribution/ProviderWorkerZipImportCard.tsx");
    assert.match(src, /accept="\.zip"/);
    assert.match(src, /requestProviderWorkerZipGenerationApi/);
    assert.match(src, /지식데이터 생성 요청/);
    // No execution affordance / legacy execute API on the Provider card.
    assert.ok(!/데이터 구조화 시작/.test(src));
    assert.ok(!/startProviderWorkerZipImportApi/.test(src));
  });

  it("material-registration tab hides legacy Docling behind a flag, keeps ZIP card", () => {
    const src = readSrc("components/provider-distribution/ProviderPayloadTab.tsx");
    assert.match(src, /ProviderWorkerZipImportCard/);
    assert.match(src, /isProviderLegacyDoclingUiEnabled/);
    // Docling manual upload is only rendered when the legacy flag is enabled.
    assert.match(src, /showLegacyDoclingImport \?/);
  });

  it("admin generation card executes via the admin API", () => {
    const src = readSrc("components/AdminWorkerZipGenerationCard.tsx");
    assert.match(src, /runAdminWorkerZipGeneration/);
    assert.match(src, /지식데이터 생성 실행/);
    // 접수(accept) action before execution.
    assert.match(src, /acceptAdminWorkerZipRequest/);
    assert.match(src, /생성 요청 접수/);
  });

  it("admin request-queue route lists pending requests for admins only", () => {
    const src = readSrc("app/api/v1/admin/worker-zip-requests/route.ts");
    assert.match(src, /requireAdminSession/);
    assert.match(src, /listAdminWorkerZipRequests/);
  });

  it("admin console surfaces the generation request queue", () => {
    const src = readSrc("components/AdminReviewListPageClient.tsx");
    assert.match(src, /AdminWorkerZipRequestQueue/);
    const queue = readSrc("components/AdminWorkerZipRequestQueue.tsx");
    assert.match(queue, /fetchAdminWorkerZipRequests/);
    assert.match(queue, /접수하고 생성 실행/);
  });
});

describe("P7.4 default exclusion policy (Worker + Store tolerance + UI)", () => {
  it("readWorkerExclusionSummary uses the report summary when present", () => {
    const summary = readWorkerExclusionSummary({
      status: "ok",
      errors: [],
      exclusionSummary: { total: 3, byReason: { excluded_extension: 2, excluded_directory: 1 } },
    });
    assert.equal(summary.total, 3);
    assert.equal(summary.byReason.excluded_extension, 2);
    assert.equal(summary.byReason.excluded_directory, 1);
  });

  it("readWorkerExclusionSummary falls back to counting excludedFiles", () => {
    const summary = readWorkerExclusionSummary({
      status: "ok",
      errors: [],
      excludedFiles: [
        { path: "a.exe", reason: "excluded_extension" },
        { path: "node_modules/x.js", reason: "excluded_directory" },
        { path: "b.dll", reason: "excluded_extension" },
      ],
    });
    assert.equal(summary.total, 3);
    assert.equal(summary.byReason.excluded_extension, 2);
    assert.equal(summary.byReason.excluded_directory, 1);
  });

  it("readWorkerExclusionSummary tolerates a report without exclusion fields", () => {
    const summary = readWorkerExclusionSummary({ status: "ok", errors: [] });
    assert.equal(summary.total, 0);
    assert.deepEqual(summary.byReason, {});
  });

  it("Store validator preserves additive excludedFiles report fields (spread, no strip)", () => {
    // Store tolerance: normalizeValidationReport must not reject/strip unknown
    // additive fields. Guard the source so an accidental allowlist can't regress it.
    const src = readSrc("lib/python-worker/worker-output-validator.ts");
    assert.match(src, /\.\.\.obj/);
  });

  it("provider ZIP card shows the pre-upload exclusion notice", () => {
    const src = readSrc("components/provider-distribution/ProviderWorkerZipImportCard.tsx");
    assert.match(src, /업로드 전 확인해 주세요/);
    assert.match(src, /node_modules/);
    assert.match(src, /실행 파일: exe, dll, msi/);
  });

  it("admin generation card renders a read-only exclusion summary", () => {
    const src = readSrc("components/AdminWorkerZipGenerationCard.tsx");
    assert.match(src, /exclusionSummary/);
    assert.match(src, /자동 제외된 파일/);
    assert.match(src, /exclusionReasonLabel/);
  });

  it("python worker ships a default exclusion policy config", () => {
    const raw = readFileSync(
      path.join(process.cwd(), "python-worker", "config", "zip_exclusion_policy.json"),
      "utf8",
    );
    const policy = JSON.parse(raw) as {
      excludeExtensions: string[];
      excludeDirectories: string[];
    };
    assert.ok(policy.excludeExtensions.includes(".exe"));
    assert.ok(policy.excludeDirectories.includes("node_modules"));
  });
});

describe("P7.3 request/execute split (Provider requests, Admin executes)", () => {
  it("submitProviderWorkerZipRequest stores the ZIP without running the Worker", async () => {
    const stored: Record<string, unknown>[] = [];
    const result = await submitProviderWorkerZipRequest({
      userId: "u1",
      clientId: "cl1",
      packId: "packA",
      bytes: new Uint8Array([1, 2, 3]),
      originalFileName: "docs.zip",
      prismaClient: {
        knowledgePack: {
          findFirst: async () => ({
            packId: "packA",
            name: "Pack A",
            status: "DRAFT",
            versions: [{ id: "verA", version: "1.0.0", language: "KO" }],
          }),
        },
      } as never,
      findProfile: async () => ({ id: "prof-1" }),
      storeRequest: (async (input: Record<string, unknown>) => {
        stored.push(input);
        return {
          objectKey: "k",
          originalFileName: input.originalFileName as string,
          fileSize: 3,
          checksumSha256: "h",
          uploadedAt: "2026-01-01T00:00:00.000Z",
          uploadedByUserId: input.uploadedByUserId as string,
        };
      }) as never,
    });
    assert.equal(result.ok, true);
    assert.equal(result.request.originalFileName, "docs.zip");
    assert.equal(stored.length, 1);
    assert.equal(stored[0]!.uploadedByUserId, "u1");
  });

  it("submitProviderWorkerZipRequest rejects a non-DRAFT pack", async () => {
    await assert.rejects(
      () =>
        submitProviderWorkerZipRequest({
          userId: "u1",
          clientId: "cl1",
          packId: "packA",
          bytes: new Uint8Array([1]),
          originalFileName: "a.zip",
          prismaClient: {
            knowledgePack: {
              findFirst: async () => ({
                packId: "packA",
                name: "A",
                status: "IN_REVIEW",
                versions: [{ id: "verA", version: "1.0.0", language: "KO" }],
              }),
            },
          } as never,
          findProfile: async () => ({ id: "prof-1" }),
          storeRequest: (async () => {
            throw new Error("should not store");
          }) as never,
        }),
      (err: unknown) =>
        err instanceof WorkerZipImportServiceError && err.code === "PACK_NOT_EDITABLE",
    );
  });

  it("submitProviderWorkerZipRequest records a PENDING request marker for the admin queue", async () => {
    const created: Record<string, unknown>[] = [];
    await submitProviderWorkerZipRequest({
      userId: "u1",
      clientId: "cl1",
      packId: "packA",
      bytes: new Uint8Array([1]),
      originalFileName: "a.zip",
      prismaClient: {
        knowledgePack: {
          findFirst: async () => ({
            packId: "packA",
            name: "A",
            status: "DRAFT",
            versions: [{ id: "verA", version: "1.0.0", language: "KO" }],
          }),
        },
        pipelineRun: {
          updateMany: async () => ({ count: 0 }),
          create: async ({ data }: { data: Record<string, unknown> }) => {
            created.push(data);
            return { id: "r" };
          },
        },
      } as never,
      findProfile: async () => ({ id: "prof-1" }),
      storeRequest: (async (i: Record<string, unknown>) => ({
        objectKey: "k",
        originalFileName: i.originalFileName as string,
        fileSize: 1,
        checksumSha256: "h",
        uploadedAt: "2026-01-01T00:00:00.000Z",
        uploadedByUserId: i.uploadedByUserId as string,
      })) as never,
    });
    assert.equal(created.length, 1);
    assert.equal(created[0]!.triggerType, WORKER_ZIP_REQUEST_TRIGGER);
    assert.equal(created[0]!.status, "PENDING");
  });

  it("listAdminWorkerZipRequests dedupes DRAFT requests by pack (newest first)", async () => {
    const items = await listAdminWorkerZipRequests({
      prismaClient: {
        pipelineRun: {
          findMany: async () => [
            {
              packId: "packA",
              createdAt: new Date(2),
              pack: {
                name: "A",
                providerProfile: { displayName: "Prov A" },
                versions: [{ id: "verA", version: "1.0.0" }],
              },
            },
            {
              packId: "packA",
              createdAt: new Date(1),
              pack: {
                name: "A",
                providerProfile: { displayName: "Prov A" },
                versions: [{ id: "verA", version: "1.0.0" }],
              },
            },
            {
              packId: "packB",
              createdAt: new Date(0),
              pack: { name: "B", providerProfile: null, versions: [] },
            },
          ],
        },
      } as never,
      getRequestMetadata: (async () => ({
        originalFileName: "a.zip",
        fileSize: 1,
        checksumSha256: "h",
        uploadedAt: "2026-01-01T00:00:00.000Z",
        uploadedByUserId: "u1",
      })) as never,
    });
    assert.equal(items.length, 2);
    assert.equal(items[0]!.packId, "packA");
    assert.equal(items[0]!.originalFileName, "a.zip");
    assert.equal(items[0]!.providerName, "Prov A");
    assert.equal(items[1]!.packId, "packB");
    assert.equal(items[1]!.originalFileName, null);
  });

  it("withdrawProviderWorkerZipRequest removes a pending request and retires the marker", async () => {
    let deleted = false;
    const marked: Record<string, unknown>[] = [];
    const result = await withdrawProviderWorkerZipRequest({
      userId: "u1",
      clientId: "cl1",
      packId: "packA",
      prismaClient: {
        knowledgePack: {
          findFirst: async () => ({
            packId: "packA",
            name: "A",
            status: "DRAFT",
            versions: [{ id: "verA", version: "1.0.0", language: "KO" }],
          }),
        },
        pipelineRun: {
          findFirst: async () => null,
          updateMany: async ({ data }: { data: Record<string, unknown> }) => {
            marked.push(data);
            return { count: 1 };
          },
        },
      } as never,
      findProfile: async () => ({ id: "prof-1" }),
      getRequestMetadata: (async () => ({
        originalFileName: "a.zip",
        fileSize: 1,
        checksumSha256: "h",
        uploadedAt: "2026-01-01T00:00:00.000Z",
        uploadedByUserId: "u1",
      })) as never,
      deleteRequest: (async () => {
        deleted = true;
      }) as never,
    });
    assert.equal(result.ok, true);
    assert.equal(deleted, true);
    assert.equal(marked[0]!.status, "SKIPPED");
  });

  it("withdrawProviderWorkerZipRequest rejects when generation is already processing", async () => {
    let deleted = false;
    await assert.rejects(
      withdrawProviderWorkerZipRequest({
        userId: "u1",
        clientId: "cl1",
        packId: "packA",
        prismaClient: {
          knowledgePack: {
            findFirst: async () => ({
              packId: "packA",
              name: "A",
              status: "DRAFT",
              versions: [{ id: "verA", version: "1.0.0", language: "KO" }],
            }),
          },
          pipelineRun: {
            findFirst: async () => ({ status: "RUNNING" }),
            updateMany: async () => ({ count: 0 }),
          },
        } as never,
        findProfile: async () => ({ id: "prof-1" }),
        getRequestMetadata: (async () => ({
          originalFileName: "a.zip",
          fileSize: 1,
          checksumSha256: "h",
          uploadedAt: "2026-01-01T00:00:00.000Z",
          uploadedByUserId: "u1",
        })) as never,
        deleteRequest: (async () => {
          deleted = true;
        }) as never,
      }),
      (err: unknown) =>
        err instanceof WorkerZipImportServiceError && err.code === "REQUEST_IN_PROGRESS",
    );
    assert.equal(deleted, false);
  });

  it("acceptAdminWorkerZipRequest marks a pending request 접수완료 (ACCEPTED)", async () => {
    const updated: Record<string, unknown>[] = [];
    const res = await acceptAdminWorkerZipRequest({
      adminUserId: "admin1",
      clientId: "cl1",
      packId: "packA",
      prismaClient: {
        knowledgePack: {
          findFirst: async () => ({
            packId: "packA",
            name: "A",
            status: "DRAFT",
            versions: [{ id: "verA", version: "1.0.0", language: "KO" }],
          }),
        },
        pipelineRun: {
          updateMany: async ({ data }: { data: Record<string, unknown> }) => {
            updated.push(data);
            return { count: 1 };
          },
          findFirst: async () => null,
          create: async () => ({ id: "r" }),
        },
      } as never,
      getRequestMetadata: (async () => ({
        originalFileName: "a.zip",
        fileSize: 1,
        checksumSha256: "h",
        uploadedAt: "2026-01-01T00:00:00.000Z",
        uploadedByUserId: "u1",
      })) as never,
    });
    assert.equal(res.requestStatus, "ACCEPTED");
    assert.equal(updated[0]!.status, WORKER_ZIP_REQUEST_ACCEPTED_STATUS);
  });

  it("getProviderWorkerZipRequestState returns ACCEPTED when the request is 접수완료", async () => {
    const state = await getProviderWorkerZipRequestState({
      userId: "u1",
      clientId: "cl1",
      packId: "packA",
      prismaClient: {
        knowledgePack: {
          findFirst: async () => ({
            packId: "packA",
            name: "A",
            status: "DRAFT",
            providerProfileId: "prof-1",
            versions: [{ id: "verA", version: "1.0.0", language: "KO" }],
          }),
        },
        pipelineRun: {
          findFirst: async ({ where }: { where: Record<string, unknown> }) =>
            where.triggerType === WORKER_ZIP_REQUEST_TRIGGER
              ? { status: WORKER_ZIP_REQUEST_ACCEPTED_STATUS }
              : null,
        },
        packReview: { findFirst: async () => null },
      } as never,
      findProfile: async () => ({ id: "prof-1" }),
      getRequestMetadata: (async () => ({
        originalFileName: "a.zip",
        fileSize: 1,
        checksumSha256: "h",
        uploadedAt: "2026-01-01T00:00:00.000Z",
        uploadedByUserId: "u1",
      })) as never,
    });
    assert.equal(state.requestStatus, "ACCEPTED");
  });

  it("withdrawProviderWorkerZipRequest rejects once the admin has accepted (접수완료)", async () => {
    let deleted = false;
    await assert.rejects(
      withdrawProviderWorkerZipRequest({
        userId: "u1",
        clientId: "cl1",
        packId: "packA",
        prismaClient: {
          knowledgePack: {
            findFirst: async () => ({
              packId: "packA",
              name: "A",
              status: "DRAFT",
              versions: [{ id: "verA", version: "1.0.0", language: "KO" }],
            }),
          },
          pipelineRun: {
            findFirst: async ({ where }: { where: Record<string, unknown> }) =>
              where.triggerType === WORKER_ZIP_REQUEST_TRIGGER
                ? { status: WORKER_ZIP_REQUEST_ACCEPTED_STATUS }
                : null,
            updateMany: async () => ({ count: 0 }),
          },
        } as never,
        findProfile: async () => ({ id: "prof-1" }),
        getRequestMetadata: (async () => ({
          originalFileName: "a.zip",
          fileSize: 1,
          checksumSha256: "h",
          uploadedAt: "2026-01-01T00:00:00.000Z",
          uploadedByUserId: "u1",
        })) as never,
        deleteRequest: (async () => {
          deleted = true;
        }) as never,
      }),
      (err: unknown) =>
        err instanceof WorkerZipImportServiceError && err.code === "REQUEST_ALREADY_ACCEPTED",
    );
    assert.equal(deleted, false);
  });

  it("getProviderWorkerZipRequestState derives COMPLETED from the last PASS run", async () => {
    const state = await getProviderWorkerZipRequestState({
      userId: "u1",
      clientId: "cl1",
      packId: "packA",
      prismaClient: {
        pipelineRun: {
          findFirst: async () => ({ status: "PASS", finishedAt: new Date(0), summary: null }),
        },
        packReview: { findFirst: async () => null },
      } as never,
      resolvePack: async () => ({
        pack: { packId: "packA", name: "A", status: "DRAFT" as never },
        version: { id: "verA", version: "1.0.0", language: "KO" },
      }),
      getRequestMetadata: (async () => ({
        originalFileName: "a.zip",
        fileSize: 10,
        checksumSha256: "h",
        uploadedAt: "2026-01-01T00:00:00.000Z",
        uploadedByUserId: "u1",
      })) as never,
    });
    assert.equal(state.requestStatus, "COMPLETED");
    assert.equal(state.request?.originalFileName, "a.zip");
  });

  it("runAdminWorkerZipGeneration blocks a duplicate run when one is RUNNING", async () => {
    await assert.rejects(
      () =>
        runAdminWorkerZipGeneration({
          adminUserId: "admin-1",
          clientId: "cl1",
          packId: "packA",
          prismaClient: {
            pipelineRun: { findFirst: async () => ({ id: "running-1" }) },
          } as never,
          resolvePack: async () => ({
            pack: { packId: "packA", name: "A", status: "DRAFT" as never },
            version: { id: "verA", version: "1.0.0", language: "KO" },
          }),
          getRequestBytes: (async () => new Uint8Array([1])) as never,
          runImport: (async () => {
            throw new Error("should not run");
          }) as never,
        }),
      (err: unknown) =>
        err instanceof WorkerZipImportServiceError && err.code === "ALREADY_RUNNING",
    );
  });

  it("runAdminWorkerZipGeneration fails when no request ZIP is present", async () => {
    await assert.rejects(
      () =>
        runAdminWorkerZipGeneration({
          adminUserId: "admin-1",
          clientId: "cl1",
          packId: "packA",
          prismaClient: {
            pipelineRun: { findFirst: async () => null },
          } as never,
          resolvePack: async () => ({
            pack: { packId: "packA", name: "A", status: "DRAFT" as never },
            version: { id: "verA", version: "1.0.0", language: "KO" },
          }),
          getRequestBytes: (async () => null) as never,
          runImport: (async () => {
            throw new Error("should not run");
          }) as never,
        }),
      (err: unknown) =>
        err instanceof WorkerZipImportServiceError && err.code === "REQUEST_NOT_FOUND",
    );
  });

  it("runAdminWorkerZipGeneration runs the import for a received request", async () => {
    let importInput: Record<string, unknown> | null = null;
    const result = await runAdminWorkerZipGeneration({
      adminUserId: "admin-1",
      clientId: "cl1",
      packId: "packA",
      prismaClient: {
        pipelineRun: { findFirst: async () => null },
      } as never,
      resolvePack: async () => ({
        pack: { packId: "packA", name: "A", status: "DRAFT" as never },
        version: { id: "verA", version: "1.0.0", language: "KO" },
      }),
      getRequestBytes: (async () => new Uint8Array([1, 2, 3])) as never,
      runImport: (async (input: Record<string, unknown>) => {
        importInput = input;
        return { ok: true, importedChunkCount: 3, generationReady: true } as never;
      }) as never,
    });
    assert.equal((result as { ok: boolean }).ok, true);
    assert.equal(importInput!.packId, "packA");
    assert.equal(importInput!.userId, "admin-1");
    // Admin execution must resolve the pack via the admin resolver, not by profile.
    assert.equal(typeof importInput!.resolvePack, "function");
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
