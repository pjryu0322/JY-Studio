/**
 * P5.2.2 — executeRetrievalApiRequest generation scope (PostgreSQL + pgvector).
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
import { prisma } from "../lib/prisma.ts";
import { executeRetrievalApiRequest } from "../lib/retrieval/retrieval-api-adapter.ts";
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
  assert.equal(table[0]?.reg, "SearchIndexVector", "SearchIndexVector table must exist");
}

function spyAdapter(queryVector: number[]): EmbeddingProviderAdapter {
  return {
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
  };
}

async function seedApiFixture(suffix: string, options?: { omitProduction?: boolean }) {
  const packId = `ra-pack-${suffix}`;
  const category =
    (await prisma.packCategory.findFirst({ select: { categoryId: true } })) ??
    (await prisma.packCategory.create({
      data: {
        categoryId: `ra-cat-${suffix}`,
        name: "RA",
        description: "t",
        icon: "book",
      },
    }));
  const user = await prisma.user.create({
    data: { email: `ra-${suffix}@example.com`, name: "RA", accountRole: "PROVIDER" },
  });
  const profile = await prisma.providerProfile.create({
    data: { displayName: "RA", description: "t", userId: user.id, status: "ACTIVE" },
  });
  await prisma.knowledgePack.create({
    data: {
      packId,
      name: "RA Pack",
      categoryId: category.categoryId,
      providerName: "RA",
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
      summary: "ra",
      startedAt: new Date(),
      finishedAt: new Date(),
    },
  });
  const bundle = await prisma.doclingImportBundle.create({
    data: {
      id: `ra-b-${suffix}`,
      packId,
      versionId: version.id,
      status: "REVIEW_READY",
      storageStatus: "ACTIVE",
      isActive: true,
    },
  });
  const normalized = await prisma.normalizedDocument.create({
    data: {
      id: `ra-nd-${suffix}`,
      bundleId: bundle.id,
      packId,
      versionId: version.id,
      adapterVersion: "test",
      fingerprint: `ra-fp-${suffix}`,
      isActive: true,
    },
  });
  const source = await prisma.sourceDocument.create({
    data: {
      id: `ra-src-${suffix}`,
      versionId: version.id,
      title: "API Guide",
      content: "source",
    },
  });

  async function createGeneration(
    scope: "DRAFT" | "PRODUCTION",
    status: "READY" | "PROMOTED" | "PENDING",
  ) {
    const generationId = `ra-gen-${suffix}-${scope.toLowerCase()}`;
    const chunkGenerationId = `ra-cg-${suffix}-${scope.toLowerCase()}`;
    return prisma.searchIndexGeneration.create({
      data: {
        id: generationId,
        packId,
        versionId: version.id,
        pipelineRunId: pipeline.id,
        normalizedDocumentId: normalized.id,
        chunkGenerationId,
        fingerprint: `ra-gfp-${suffix}-${scope}`,
        embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
        embeddingModel: DEFAULT_E5_MODEL_ID,
        embeddingModelRevision: SHA,
        embeddingDimension: DEFAULT_E5_EMBEDDING_DIMENSION,
        distanceMetric: "cosine",
        status,
        scope,
        generationFingerprint: `ra-gf-${suffix}-${scope}`,
        chunkCount: 1,
        embeddedCount: 1,
      },
    });
  }

  const draft = await createGeneration("DRAFT", "READY");
  const production = options?.omitProduction
    ? null
    : await createGeneration("PRODUCTION", "PROMOTED");

  return {
    packId,
    version,
    source,
    draft,
    production,
    async cleanup() {
      await prisma.knowledgePack.delete({ where: { packId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    },
  };
}

describe("executeRetrievalApiRequest generation scope (skipped without DATABASE_URL)", {
  skip: !hasDb,
}, () => {
  const cleanups: Array<() => Promise<void>> = [];
  after(async () => {
    for (const fn of cleanups.reverse()) await fn();
  });

  it("PUBLIC returns only PRODUCTION generation chunks", async () => {
    await assertPgvectorRuntimeReady();
    const suffix = randomUUID().slice(0, 8);
    const seeded = await seedApiFixture(suffix);
    cleanups.push(seeded.cleanup);
    assert.ok(seeded.production);

    const query = unitVector(5, DEFAULT_E5_EMBEDDING_DIMENSION);
    const adapter = spyAdapter(query);

    const prodChunk = await prisma.knowledgeChunk.create({
      data: {
        id: `ra-p-${suffix}`,
        versionId: seeded.version.id,
        sourceDocumentId: seeded.source.id,
        chunkType: "retrieval",
        title: "prod",
        content: "production grid sort",
        tags: [],
        chunkGenerationId: seeded.production.chunkGenerationId,
        metadata: { indexGenerationId: seeded.production.chunkGenerationId },
        isActive: true,
      },
    });
    const draftChunk = await prisma.knowledgeChunk.create({
      data: {
        id: `ra-d-${suffix}`,
        versionId: seeded.version.id,
        sourceDocumentId: seeded.source.id,
        chunkType: "retrieval",
        title: "draft",
        content: "draft multi column",
        tags: [],
        chunkGenerationId: seeded.draft.chunkGenerationId,
        metadata: { indexGenerationId: seeded.draft.chunkGenerationId },
        isActive: true,
      },
    });

    for (const [chunk, genId] of [
      [prodChunk, seeded.production.id],
      [draftChunk, seeded.draft.id],
    ] as const) {
      await upsertSearchIndexVector(
        {
          searchIndexGenerationId: genId,
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

    const result = await executeRetrievalApiRequest({
      knowledgePackId: seeded.packId,
      query: "sort",
      filters: {},
      topK: 5,
      includeMetadata: true,
      retrievalMode: "hybrid",
      requestId: `pub-${suffix}`,
      serviceChannel: "API",
      executionMode: "PUBLIC",
      hybridTestHooks: { resolveAdapter: () => adapter },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.data.contexts.some((c) => c.chunkId === prodChunk.id));
    assert.equal(result.data.contexts.some((c) => c.chunkId === draftChunk.id), false);
    assert.equal(result.data.usage.retrievalMode, "hybrid");
    assert.ok(Array.isArray(result.data.contexts));
    assert.ok("requestId" in result.data.usage);
    assert.ok("contextCount" in result.data.usage);
  });

  it("PROVIDER_VALIDATION returns only DRAFT generation chunks", async () => {
    await assertPgvectorRuntimeReady();
    const suffix = randomUUID().slice(0, 8);
    const seeded = await seedApiFixture(suffix);
    cleanups.push(seeded.cleanup);
    assert.ok(seeded.production);

    const query = unitVector(8, DEFAULT_E5_EMBEDDING_DIMENSION);
    const adapter = spyAdapter(query);

    const prodChunk = await prisma.knowledgeChunk.create({
      data: {
        id: `ra-pp-${suffix}`,
        versionId: seeded.version.id,
        sourceDocumentId: seeded.source.id,
        chunkType: "retrieval",
        title: "prod",
        content: "production only",
        tags: [],
        chunkGenerationId: seeded.production.chunkGenerationId,
        metadata: { indexGenerationId: seeded.production.chunkGenerationId },
        isActive: true,
      },
    });
    const draftChunk = await prisma.knowledgeChunk.create({
      data: {
        id: `ra-dd-${suffix}`,
        versionId: seeded.version.id,
        sourceDocumentId: seeded.source.id,
        chunkType: "retrieval",
        title: "draft",
        content: "draft validation sort",
        tags: [],
        chunkGenerationId: seeded.draft.chunkGenerationId,
        metadata: { indexGenerationId: seeded.draft.chunkGenerationId },
        isActive: true,
      },
    });

    for (const [chunk, genId] of [
      [prodChunk, seeded.production.id],
      [draftChunk, seeded.draft.id],
    ] as const) {
      await upsertSearchIndexVector(
        {
          searchIndexGenerationId: genId,
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

    const result = await executeRetrievalApiRequest({
      knowledgePackId: seeded.packId,
      versionId: seeded.version.id,
      indexGenerationId: seeded.draft.chunkGenerationId,
      query: "sort",
      filters: {},
      topK: 5,
      includeMetadata: true,
      retrievalMode: "hybrid",
      requestId: `prov-${suffix}`,
      serviceChannel: "API",
      executionMode: "PROVIDER_VALIDATION",
      hybridTestHooks: { resolveAdapter: () => adapter },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.data.contexts.some((c) => c.chunkId === draftChunk.id));
    assert.equal(result.data.contexts.some((c) => c.chunkId === prodChunk.id), false);
  });

  it("PUBLIC fails closed when PRODUCTION generation is missing", async () => {
    const suffix = randomUUID().slice(0, 8);
    const seeded = await seedApiFixture(suffix, { omitProduction: true });
    cleanups.push(seeded.cleanup);

    await prisma.knowledgeChunk.create({
      data: {
        id: `ra-only-${suffix}`,
        versionId: seeded.version.id,
        sourceDocumentId: seeded.source.id,
        chunkType: "retrieval",
        title: "draft only",
        content: "draft content",
        tags: [],
        chunkGenerationId: seeded.draft.chunkGenerationId,
        metadata: { indexGenerationId: seeded.draft.chunkGenerationId },
        isActive: true,
      },
    });

    const result = await executeRetrievalApiRequest({
      knowledgePackId: seeded.packId,
      query: "sort",
      filters: {},
      topK: 5,
      includeMetadata: true,
      retrievalMode: "hybrid",
      requestId: `noprod-${suffix}`,
      serviceChannel: "API",
      executionMode: "PUBLIC",
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "SEARCH_GENERATION_NOT_READY");
    assert.equal(result.httpStatus, 503);
  });
});
