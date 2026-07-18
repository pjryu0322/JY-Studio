/**
 * P5.2.2 — retrieveContextsForVersion hybrid orchestration (PostgreSQL + pgvector).
 * Requires DATABASE_URL and pgvector. Missing runtime is FAIL (never fake PASS).
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PackStatus } from "@prisma/client";
import type { EmbeddingProviderAdapter } from "../lib/embedding/embedding-provider-adapter.ts";
import {
  DEFAULT_E5_EMBEDDING_DIMENSION,
  DEFAULT_E5_MODEL_ID,
  LOCAL_E5_EMBEDDING_PROVIDER,
} from "../lib/embedding/e5-embedding-constants.ts";
import { isPayloadServiceError } from "../lib/distribution/payload-errors.ts";
import { prisma } from "../lib/prisma.ts";
import { retrieveContextsForVersion } from "../lib/retrieval-service.ts";
import { upsertSearchIndexVector } from "../lib/search-vector/search-vector-store.ts";

function ensureDatabaseUrlFromDotEnv(): void {
  if (process.env.DATABASE_URL?.trim()) return;
  const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".env");
  if (!existsSync(envPath)) return;
  const match = readFileSync(envPath, "utf8").match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m);
  if (!match?.[1]) return;
  let value = match[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  process.env.DATABASE_URL = value;
}

ensureDatabaseUrlFromDotEnv();
const hasDb = Boolean(process.env.DATABASE_URL?.trim());

const SHA = "fcfc26bf355882620c48df58be112275bd756f50";

function unitVector(seed: number, dimension: number): number[] {
  const values = Array.from({ length: dimension }, (_, i) => Math.sin(seed * 17 + i * 0.37));
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0)) || 1;
  return values.map((v) => v / norm);
}

function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

async function assertPgvectorRuntimeReady(): Promise<void> {
  const ext = await prisma.$queryRaw<Array<{ extversion: string }>>`
    SELECT extversion FROM pg_extension WHERE extname = 'vector'
  `;
  assert.ok(ext.length === 1, "pgvector extension must be installed (CREATE EXTENSION vector)");
  const table = await prisma.$queryRaw<Array<{ reg: string | null }>>`
    SELECT to_regclass('"SearchIndexVector"')::text AS reg
  `;
  // to_regclass::text quote_ident's mixed-case names → "SearchIndexVector"
  assert.ok(
    table[0]?.reg === "SearchIndexVector" || table[0]?.reg === '"SearchIndexVector"',
    "SearchIndexVector table must exist",
  );
}

function spyAdapter(queryVector: number[]): {
  adapter: EmbeddingProviderAdapter;
  embedCalls: () => number;
} {
  let calls = 0;
  return {
    embedCalls: () => calls,
    adapter: {
      id: "test-spy-e5",
      resolveDescriptor() {
        return {
          provider: LOCAL_E5_EMBEDDING_PROVIDER,
          model: DEFAULT_E5_MODEL_ID,
          dimension: DEFAULT_E5_EMBEDDING_DIMENSION,
          modelRevision: SHA,
        };
      },
      async embed() {
        calls += 1;
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
        return {
          ok: true,
          provider: LOCAL_E5_EMBEDDING_PROVIDER,
          checkedAt: new Date().toISOString(),
        };
      },
    },
  };
}

async function seedHybridFixture(suffix: string) {
  const packId = `rh-pack-${suffix}`;
  const category =
    (await prisma.packCategory.findFirst({ select: { categoryId: true } })) ??
    (await prisma.packCategory.create({
      data: {
        categoryId: `rh-cat-${suffix}`,
        name: "RH",
        description: "t",
        icon: "book",
      },
    }));
  const user = await prisma.user.create({
    data: { email: `rh-${suffix}@example.com`, name: "RH", accountRole: "PROVIDER" },
  });
  const profile = await prisma.providerProfile.create({
    data: { displayName: "RH", description: "t", userId: user.id, status: "ACTIVE" },
  });
  await prisma.knowledgePack.create({
    data: {
      packId,
      name: "RH Pack",
      categoryId: category.categoryId,
      providerName: "RH",
      providerType: "COMMUNITY",
      status: PackStatus.PUBLISHED,
      pricing: "FREE",
      icon: "book",
      shortDescription: "s",
      description: "d",
      tags: [],
      providerProfileId: profile.id,
    },
  });
  const version = await prisma.knowledgePackVersion.create({
    data: {
      packId,
      version: "1.0.0",
      overview: "o",
      features: [],
      includedKnowledge: [],
      supportedEnvironments: [],
      targetUsers: [],
      useCases: [],
      versionSummary: "vs",
    },
  });
  await prisma.packDistributionMetadata.create({
    data: {
      packId,
      versionId: version.id,
      licenseName: "MIT",
      visibility: "PUBLIC",
      allowApi: true,
      allowMcp: true,
      allowDownload: false,
    },
  });
  const pipeline = await prisma.pipelineRun.create({
    data: {
      packId,
      triggerType: "TEST",
      status: "PASS",
      summary: "rh",
      startedAt: new Date(),
      finishedAt: new Date(),
    },
  });
  const bundle = await prisma.doclingImportBundle.create({
    data: {
      id: `rh-b-${suffix}`,
      packId,
      versionId: version.id,
      status: "REVIEW_READY",
      storageStatus: "ACTIVE",
      isActive: true,
    },
  });
  const normalized = await prisma.normalizedDocument.create({
    data: {
      id: `rh-nd-${suffix}`,
      bundleId: bundle.id,
      packId,
      versionId: version.id,
      adapterVersion: "test",
      fingerprint: `rh-fp-${suffix}`,
      isActive: true,
    },
  });
  const source = await prisma.sourceDocument.create({
    data: {
      id: `rh-src-${suffix}`,
      versionId: version.id,
      title: "Grid Guide",
      content: "source",
    },
  });

  async function createGeneration(
    scope: "DRAFT" | "PRODUCTION",
    status: "READY" | "PROMOTED",
  ) {
    const generationId = `rh-gen-${suffix}-${scope.toLowerCase()}`;
    const chunkGenerationId = `rh-cg-${suffix}-${scope.toLowerCase()}`;
    const generation = await prisma.searchIndexGeneration.create({
      data: {
        id: generationId,
        packId,
        versionId: version.id,
        pipelineRunId: pipeline.id,
        normalizedDocumentId: normalized.id,
        chunkGenerationId,
        fingerprint: `rh-gfp-${suffix}-${scope}`,
        embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
        embeddingModel: DEFAULT_E5_MODEL_ID,
        embeddingModelRevision: SHA,
        embeddingDimension: DEFAULT_E5_EMBEDDING_DIMENSION,
        distanceMetric: "cosine",
        status,
        scope,
        generationFingerprint: `rh-gf-${suffix}-${scope}`,
        chunkCount: 2,
        embeddedCount: 2,
      },
    });
    return { generation, chunkGenerationId };
  }

  const production = await createGeneration("PRODUCTION", "PROMOTED");
  const draft = await createGeneration("DRAFT", "READY");

  return {
    packId,
    version,
    source,
    production,
    draft,
    async cleanup() {
      await prisma.knowledgePack.delete({ where: { packId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    },
  };
}

describe("retrieveContextsForVersion hybrid service (skipped without DATABASE_URL)", {
  skip: !hasDb,
}, () => {
  const cleanups: Array<() => Promise<void>> = [];
  after(async () => {
    for (const fn of cleanups.reverse()) await fn();
  });

  it("includes vector-only semantic candidates and embeds once", async () => {
    await assertPgvectorRuntimeReady();
    const suffix = randomUUID().slice(0, 8);
    const seeded = await seedHybridFixture(suffix);
    cleanups.push(seeded.cleanup);

    const query = unitVector(7, DEFAULT_E5_EMBEDDING_DIMENSION);
    const low = unitVector(99, DEFAULT_E5_EMBEDDING_DIMENSION);
    const high = unitVector(7, DEFAULT_E5_EMBEDDING_DIMENSION);
    const { adapter, embedCalls } = spyAdapter(query);

    const keywordChunk = await prisma.knowledgeChunk.create({
      data: {
        id: `rh-kw-${suffix}`,
        versionId: seeded.version.id,
        sourceDocumentId: seeded.source.id,
        chunkType: "retrieval",
        title: "keyword candidate",
        content: "행을 정렬하는 방법이라는 문구만 포함",
        tags: [],
        chunkGenerationId: seeded.production.chunkGenerationId,
        metadata: {
          indexGenerationId: seeded.production.chunkGenerationId,
          page: 1,
          product: "grid",
        },
        isActive: true,
      },
    });
    const semanticChunk = await prisma.knowledgeChunk.create({
      data: {
        id: `rh-sem-${suffix}`,
        versionId: seeded.version.id,
        sourceDocumentId: seeded.source.id,
        chunkType: "retrieval",
        title: "semantic candidate",
        content: "Grid의 sort API를 사용하면 컬럼 기준으로 행을 정렬할 수 있습니다.",
        tags: [],
        chunkGenerationId: seeded.production.chunkGenerationId,
        metadata: {
          indexGenerationId: seeded.production.chunkGenerationId,
          pageStart: 2,
          product: "grid",
        },
        isActive: true,
      },
    });

    for (const [chunk, vector] of [
      [keywordChunk, low],
      [semanticChunk, high],
    ] as const) {
      const write = await upsertSearchIndexVector(
        {
          searchIndexGenerationId: seeded.production.generation.id,
          chunkId: chunk.id,
          provider: LOCAL_E5_EMBEDDING_PROVIDER,
          model: DEFAULT_E5_MODEL_ID,
          dimension: DEFAULT_E5_EMBEDDING_DIMENSION,
          contentHash: contentHash(chunk.content),
          vector,
        },
        prisma,
        { NODE_ENV: "test", JYKSTORE_REQUIRE_PGVECTOR: "true" },
      );
      assert.deepEqual(write, { ok: true, skipped: false });
    }

    const response = await retrieveContextsForVersion({
      packId: seeded.packId,
      versionId: seeded.version.id,
      query: "행을 정렬하는 방법",
      filters: {},
      topK: 5,
      includeMetadata: true,
      retrievalMode: "hybrid",
      requestId: `req-${suffix}`,
      indexGenerationId: seeded.production.chunkGenerationId,
      searchIndexGenerationId: seeded.production.generation.id,
      excludeDraftScope: true,
      hybridTestHooks: { resolveAdapter: () => adapter },
    });

    assert.equal(embedCalls(), 1);
    assert.equal(response.usage.embeddingProvider, LOCAL_E5_EMBEDDING_PROVIDER);
    assert.equal(response.usage.embeddingModel, DEFAULT_E5_MODEL_ID);
    assert.equal(response.usage.retrievalMode, "hybrid");

    const semantic = response.contexts.find((c) => c.chunkId === semanticChunk.id);
    const keyword = response.contexts.find((c) => c.chunkId === keywordChunk.id);
    assert.ok(semantic, "vector-only/semantic candidate must appear in contexts");
    assert.ok(semantic.matchReasons.includes("vector:similarity"));
    assert.ok((semantic.scoreDetail?.vectorSimilarity ?? 0) > (keyword?.scoreDetail?.vectorSimilarity ?? -1));
    assert.equal(semantic.references?.[0]?.sourceDocumentId, seeded.source.id);
    assert.equal(semantic.metadata?.pageStart, 2);
  });

  it("applies metadata filters to vector candidates", async () => {
    await assertPgvectorRuntimeReady();
    const suffix = randomUUID().slice(0, 8);
    const seeded = await seedHybridFixture(suffix);
    cleanups.push(seeded.cleanup);
    const query = unitVector(3, DEFAULT_E5_EMBEDDING_DIMENSION);
    const { adapter } = spyAdapter(query);

    const grid = await prisma.knowledgeChunk.create({
      data: {
        id: `rh-grid-${suffix}`,
        versionId: seeded.version.id,
        sourceDocumentId: seeded.source.id,
        chunkType: "retrieval",
        title: "grid",
        content: "Grid sort",
        tags: [],
        chunkGenerationId: seeded.production.chunkGenerationId,
        metadata: {
          indexGenerationId: seeded.production.chunkGenerationId,
          productName: "grid",
        },
        isActive: true,
      },
    });
    const chart = await prisma.knowledgeChunk.create({
      data: {
        id: `rh-chart-${suffix}`,
        versionId: seeded.version.id,
        sourceDocumentId: seeded.source.id,
        chunkType: "retrieval",
        title: "chart",
        content: "Chart legend",
        tags: [],
        chunkGenerationId: seeded.production.chunkGenerationId,
        metadata: {
          indexGenerationId: seeded.production.chunkGenerationId,
          productName: "chart",
        },
        isActive: true,
      },
    });

    for (const chunk of [grid, chart]) {
      await upsertSearchIndexVector(
        {
          searchIndexGenerationId: seeded.production.generation.id,
          chunkId: chunk.id,
          provider: LOCAL_E5_EMBEDDING_PROVIDER,
          model: DEFAULT_E5_MODEL_ID,
          dimension: DEFAULT_E5_EMBEDDING_DIMENSION,
          contentHash: contentHash(chunk.content),
          vector: query,
        },
        prisma,
        { NODE_ENV: "test", JYKSTORE_REQUIRE_PGVECTOR: "true" },
      );
    }

    const response = await retrieveContextsForVersion({
      packId: seeded.packId,
      versionId: seeded.version.id,
      query: "정렬",
      filters: { productName: "grid" },
      topK: 5,
      includeMetadata: true,
      retrievalMode: "hybrid",
      requestId: `req-meta-${suffix}`,
      indexGenerationId: seeded.production.chunkGenerationId,
      searchIndexGenerationId: seeded.production.generation.id,
      excludeDraftScope: true,
      hybridTestHooks: { resolveAdapter: () => adapter },
    });

    assert.ok(response.contexts.some((c) => c.chunkId === grid.id));
    assert.equal(
      response.contexts.some((c) => c.chunkId === chart.id),
      false,
    );
  });

  it("isolates production and draft generations", async () => {
    await assertPgvectorRuntimeReady();
    const suffix = randomUUID().slice(0, 8);
    const seeded = await seedHybridFixture(suffix);
    cleanups.push(seeded.cleanup);
    const query = unitVector(11, DEFAULT_E5_EMBEDDING_DIMENSION);
    const { adapter } = spyAdapter(query);

    const prodChunk = await prisma.knowledgeChunk.create({
      data: {
        id: `rh-pchunk-${suffix}`,
        versionId: seeded.version.id,
        sourceDocumentId: seeded.source.id,
        chunkType: "retrieval",
        title: "prod",
        content: "production sort api",
        tags: [],
        chunkGenerationId: seeded.production.chunkGenerationId,
        metadata: { indexGenerationId: seeded.production.chunkGenerationId },
        isActive: true,
      },
    });
    const draftChunk = await prisma.knowledgeChunk.create({
      data: {
        id: `rh-dchunk-${suffix}`,
        versionId: seeded.version.id,
        sourceDocumentId: seeded.source.id,
        chunkType: "retrieval",
        title: "draft",
        content: "draft multi column sort",
        tags: [],
        chunkGenerationId: seeded.draft.chunkGenerationId,
        metadata: { indexGenerationId: seeded.draft.chunkGenerationId },
        isActive: true,
      },
    });

    for (const [chunk, generationId] of [
      [prodChunk, seeded.production.generation.id],
      [draftChunk, seeded.draft.generation.id],
    ] as const) {
      await upsertSearchIndexVector(
        {
          searchIndexGenerationId: generationId,
          chunkId: chunk.id,
          provider: LOCAL_E5_EMBEDDING_PROVIDER,
          model: DEFAULT_E5_MODEL_ID,
          dimension: DEFAULT_E5_EMBEDDING_DIMENSION,
          contentHash: contentHash(chunk.content),
          vector: query,
        },
        prisma,
        { NODE_ENV: "test", JYKSTORE_REQUIRE_PGVECTOR: "true" },
      );
    }

    const prod = await retrieveContextsForVersion({
      packId: seeded.packId,
      versionId: seeded.version.id,
      query: "sort",
      filters: {},
      topK: 5,
      includeMetadata: true,
      retrievalMode: "hybrid",
      requestId: `req-prod-${suffix}`,
      indexGenerationId: seeded.production.chunkGenerationId,
      searchIndexGenerationId: seeded.production.generation.id,
      excludeDraftScope: true,
      hybridTestHooks: { resolveAdapter: () => adapter },
    });
    assert.ok(prod.contexts.some((c) => c.chunkId === prodChunk.id));
    assert.equal(prod.contexts.some((c) => c.chunkId === draftChunk.id), false);

    const draft = await retrieveContextsForVersion({
      packId: seeded.packId,
      versionId: seeded.version.id,
      query: "sort",
      filters: {},
      topK: 5,
      includeMetadata: true,
      retrievalMode: "hybrid",
      requestId: `req-draft-${suffix}`,
      indexGenerationId: seeded.draft.chunkGenerationId,
      searchIndexGenerationId: seeded.draft.generation.id,
      excludeDraftScope: false,
      hybridTestHooks: { resolveAdapter: () => adapter },
    });
    assert.ok(draft.contexts.some((c) => c.chunkId === draftChunk.id));
    assert.equal(draft.contexts.some((c) => c.chunkId === prodChunk.id), false);
  });

  it("fails closed when searchIndexGenerationId is missing", async () => {
    await assert.rejects(
      () =>
        retrieveContextsForVersion({
          packId: "any",
          versionId: "any",
          query: "행을 정렬하는 방법",
          filters: {},
          topK: 5,
          includeMetadata: true,
          retrievalMode: "hybrid",
          requestId: "req-missing",
          searchIndexGenerationId: "missing-generation-id",
        }),
      (error: unknown) =>
        isPayloadServiceError(error) &&
        error.code === "SEARCH_GENERATION_NOT_READY" &&
        error.httpStatus === 503,
    );
  });
});
