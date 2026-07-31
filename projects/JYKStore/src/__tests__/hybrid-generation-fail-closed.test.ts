import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SearchIndexGeneration } from "@prisma/client";
import { PayloadServiceError, isPayloadServiceError } from "@/lib/distribution/payload-errors";
import type { EmbeddingProviderAdapter } from "@/lib/embedding/embedding-provider-adapter";
import {
  DEFAULT_E5_EMBEDDING_DIMENSION,
  DEFAULT_E5_MODEL_ID,
  LOCAL_E5_EMBEDDING_PROVIDER,
} from "@/lib/embedding/e5-embedding-constants";
import { requireSearchGeneration } from "@/lib/retrieval/hybrid-generation-guard";
import { applyHybridVectorRanking } from "@/lib/retrieval/hybrid-ranking-service";
import { mapRetrievalRuntimeError } from "@/lib/retrieval/retrieval-api-adapter";

const SHA = "fcfc26bf355882620c48df58be112275bd756f50";

function fakeGeneration(overrides: Partial<SearchIndexGeneration> = {}): SearchIndexGeneration {
  return {
    id: "gen-1",
    packId: "pack-1",
    versionId: "ver-1",
    pipelineRunId: "pipe-1",
    normalizedDocumentId: "nd-1",
    chunkGenerationId: "cg-1",
    fingerprint: "fp",
    embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
    embeddingModel: DEFAULT_E5_MODEL_ID,
    embeddingModelRevision: SHA,
    embeddingDimension: DEFAULT_E5_EMBEDDING_DIMENSION,
    distanceMetric: "cosine",
    chunkCount: 0,
    embeddedCount: 0,
    failedCount: 0,
    status: "PROMOTED",
    scope: "PRODUCTION",
    generationFingerprint: "gfp",
    attempt: 0,
    failureCode: null,
    failureMessage: null,
    createdAt: new Date(),
    startedAt: null,
    completedAt: null,
    promotedAt: null,
    staleAt: null,
    retiredAt: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("hybrid generation fail-closed", () => {
  it("requireSearchGeneration throws SEARCH_GENERATION_NOT_READY when missing", async () => {
    await assert.rejects(
      () =>
        requireSearchGeneration("missing-id", {
          searchIndexGeneration: {
            findUnique: async () => null,
          },
        } as never),
      (error: unknown) =>
        isPayloadServiceError(error) &&
        error.code === "SEARCH_GENERATION_NOT_READY" &&
        error.httpStatus === 503,
    );
  });

  it("requireSearchGeneration rejects incomplete descriptors", async () => {
    await assert.rejects(
      () =>
        requireSearchGeneration("gen-1", {
          searchIndexGeneration: {
            findUnique: async () => fakeGeneration({ embeddingDimension: 0 }),
          },
        } as never),
      (error: unknown) =>
        isPayloadServiceError(error) && error.code === "SEARCH_GENERATION_NOT_READY",
    );
  });

  it("applyHybridVectorRanking fails closed and never uses legacy local-hash", async () => {
    let legacyAdapterUsed = false;
    await assert.rejects(
      () =>
        applyHybridVectorRanking({
          scored: [],
          searchQuery: "행을 정렬하는 방법",
          searchIndexGenerationId: "missing-generation-id",
          requireGeneration: async () => {
            throw new PayloadServiceError(
              "SEARCH_GENERATION_NOT_READY",
              "검색 Generation을 확인할 수 없습니다.",
              503,
            );
          },
          resolveAdapter: () => {
            legacyAdapterUsed = true;
            throw new Error("adapter must not be resolved after generation failure");
          },
        }),
      (error: unknown) =>
        isPayloadServiceError(error) &&
        error.code === "SEARCH_GENERATION_NOT_READY" &&
        error.httpStatus === 503,
    );
    assert.equal(legacyAdapterUsed, false);
  });

  it("mapRetrievalRuntimeError maps SEARCH_GENERATION_NOT_READY to HTTP 503", () => {
    const mapped = mapRetrievalRuntimeError(
      new PayloadServiceError(
        "SEARCH_GENERATION_NOT_READY",
        "검색 Generation을 확인할 수 없습니다.",
        503,
      ),
    );
    assert.equal(mapped.ok, false);
    if (!mapped.ok) {
      assert.equal(mapped.code, "SEARCH_GENERATION_NOT_READY");
      assert.equal(mapped.httpStatus, 503);
    }
  });

  it("counts adapter.embed once on the generation path", async () => {
    let embedCalls = 0;
    const queryVector = Array.from({ length: DEFAULT_E5_EMBEDDING_DIMENSION }, (_, i) =>
      i === 0 ? 1 : 0,
    );
    const adapter: EmbeddingProviderAdapter = {
      id: "test-spy",
      resolveDescriptor() {
        return {
          provider: LOCAL_E5_EMBEDDING_PROVIDER,
          model: DEFAULT_E5_MODEL_ID,
          dimension: DEFAULT_E5_EMBEDDING_DIMENSION,
          modelRevision: SHA,
        };
      },
      async embed() {
        embedCalls += 1;
        return {
          provider: LOCAL_E5_EMBEDDING_PROVIDER,
          model: DEFAULT_E5_MODEL_ID,
          dimension: DEFAULT_E5_EMBEDDING_DIMENSION,
          vector: queryVector,
        };
      },
      async embedBatch() {
        throw new Error("embedBatch must not be called");
      },
      async healthCheck() {
        return { ok: true, provider: LOCAL_E5_EMBEDDING_PROVIDER, checkedAt: new Date().toISOString() };
      },
    };

    // Without pgvector this falls through to generation-scoped JSON path after one embed.
    const prevAllow = process.env.JYKSTORE_ALLOW_JSON_VECTOR_FALLBACK;
    const prevRequire = process.env.JYKSTORE_REQUIRE_PGVECTOR;
    process.env.JYKSTORE_ALLOW_JSON_VECTOR_FALLBACK = "true";
    delete process.env.JYKSTORE_REQUIRE_PGVECTOR;
    try {
      const result = await applyHybridVectorRanking({
        scored: [],
        searchQuery: "행을 정렬하는 방법",
        searchIndexGenerationId: "gen-1",
        requireGeneration: async () => fakeGeneration(),
        resolveAdapter: () => adapter,
        // No pgvector in this unit test; simulate "unavailable" so the JSON fallback path
        // is exercised without touching a live database.
        queryVectorsByGeneration: async () => null,
      });

      assert.equal(embedCalls, 1);
      assert.equal(result.embeddingProvider, LOCAL_E5_EMBEDDING_PROVIDER);
      assert.equal(result.embeddingModel, DEFAULT_E5_MODEL_ID);
      assert.equal(result.vectorBackend, "json_fallback");
    } finally {
      if (prevAllow === undefined) delete process.env.JYKSTORE_ALLOW_JSON_VECTOR_FALLBACK;
      else process.env.JYKSTORE_ALLOW_JSON_VECTOR_FALLBACK = prevAllow;
      if (prevRequire === undefined) delete process.env.JYKSTORE_REQUIRE_PGVECTOR;
      else process.env.JYKSTORE_REQUIRE_PGVECTOR = prevRequire;
    }
  });
});
