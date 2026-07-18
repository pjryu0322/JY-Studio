/**
 * P5.2 — SearchIndexVector / pgvector runtime (PostgreSQL).
 * Requires DATABASE_URL. Missing pgvector / SearchIndexVector is a FAIL (never fake PASS).
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PackStatus } from "@prisma/client";
import { isEmbeddingProviderError } from "../lib/embedding/embedding-provider-errors.ts";
import {
  DEFAULT_E5_EMBEDDING_DIMENSION,
  DEFAULT_E5_MODEL_ID,
  LOCAL_E5_EMBEDDING_PROVIDER,
} from "../lib/embedding/e5-embedding-constants.ts";
import { prisma } from "../lib/prisma.ts";
import { querySearchIndexVectorsByGeneration } from "../lib/search-vector/search-vector-query.ts";
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

async function seedGenerationPair(suffix: string) {
  const packId = `sv-pack-${suffix}`;
  const category =
    (await prisma.packCategory.findFirst({ select: { categoryId: true } })) ??
    (await prisma.packCategory.create({
      data: {
        categoryId: `sv-cat-${suffix}`,
        name: "SV",
        description: "t",
        icon: "book",
      },
    }));
  const user = await prisma.user.create({
    data: { email: `sv-${suffix}@example.com`, name: "SV", accountRole: "PROVIDER" },
  });
  const profile = await prisma.providerProfile.create({
    data: { displayName: "SV", description: "t", userId: user.id, status: "ACTIVE" },
  });
  await prisma.knowledgePack.create({
    data: {
      packId,
      name: "SV Pack",
      categoryId: category.categoryId,
      providerName: "SV",
      providerType: "COMMUNITY",
      status: PackStatus.DRAFT,
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
  const pipeline = await prisma.pipelineRun.create({
    data: {
      packId,
      triggerType: "TEST",
      status: "PASS",
      summary: "sv",
      startedAt: new Date(),
      finishedAt: new Date(),
    },
  });
  const bundle = await prisma.doclingImportBundle.create({
    data: {
      id: `sv-b-${suffix}`,
      packId,
      versionId: version.id,
      status: "REVIEW_READY",
      storageStatus: "ACTIVE",
      isActive: true,
    },
  });
  const normalized = await prisma.normalizedDocument.create({
    data: {
      id: `sv-nd-${suffix}`,
      bundleId: bundle.id,
      packId,
      versionId: version.id,
      adapterVersion: "test",
      fingerprint: `sv-fp-${suffix}`,
      isActive: true,
    },
  });

  async function createGeneration(scope: "DRAFT" | "PRODUCTION", status: "READY" | "PROMOTED") {
    const generationId = `sv-gen-${suffix}-${scope.toLowerCase()}`;
    const chunkGenerationId = `sv-cg-${suffix}-${scope.toLowerCase()}`;
    const generation = await prisma.searchIndexGeneration.create({
      data: {
        id: generationId,
        packId,
        versionId: version.id,
        pipelineRunId: pipeline.id,
        normalizedDocumentId: normalized.id,
        chunkGenerationId,
        fingerprint: `sv-gfp-${suffix}-${scope}`,
        embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
        embeddingModel: DEFAULT_E5_MODEL_ID,
        embeddingModelRevision: SHA,
        embeddingDimension: DEFAULT_E5_EMBEDDING_DIMENSION,
        distanceMetric: "cosine",
        status,
        scope,
        generationFingerprint: `sv-gf-${suffix}-${scope}`,
        chunkCount: 1,
        embeddedCount: 1,
      },
    });
    const chunk = await prisma.knowledgeChunk.create({
      data: {
        id: `sv-chunk-${suffix}-${scope.toLowerCase()}`,
        versionId: version.id,
        chunkType: "retrieval",
        title: scope === "PRODUCTION" ? "Grid sort API 기본 사용법" : "Grid multi-column sort",
        content:
          scope === "PRODUCTION"
            ? "Grid의 sort API를 사용하면 컬럼 기준으로 행을 정렬할 수 있습니다."
            : "Grid 신규 multi-column sort API 사용법",
        tags: [],
        chunkGenerationId,
        metadata: { indexGenerationId: chunkGenerationId },
        isActive: true,
      },
    });
    return { generation, chunk };
  }

  const production = await createGeneration("PRODUCTION", "PROMOTED");
  const draft = await createGeneration("DRAFT", "READY");
  return { packId, version, production, draft };
}

describe("search-vector pgvector runtime (skipped without DATABASE_URL)", { skip: !hasDb }, () => {
  it("requires pgvector extension and SearchIndexVector table", async () => {
    await assertPgvectorRuntimeReady();
  });

  it("upserts vectors, cosine-queries, and isolates generations", async () => {
    await assertPgvectorRuntimeReady();
    const suffix = randomUUID().slice(0, 8);
    const seeded = await seedGenerationPair(suffix);
    const related = unitVector(1, DEFAULT_E5_EMBEDDING_DIMENSION);
    const unrelated = unitVector(99, DEFAULT_E5_EMBEDDING_DIMENSION);
    const query = unitVector(1, DEFAULT_E5_EMBEDDING_DIMENSION);

    const writeProd = await upsertSearchIndexVector(
      {
        searchIndexGenerationId: seeded.production.generation.id,
        chunkId: seeded.production.chunk.id,
        provider: LOCAL_E5_EMBEDDING_PROVIDER,
        model: DEFAULT_E5_MODEL_ID,
        dimension: DEFAULT_E5_EMBEDDING_DIMENSION,
        contentHash: contentHash(seeded.production.chunk.content),
        vector: related,
      },
      prisma,
      { NODE_ENV: "test", JYKSTORE_REQUIRE_PGVECTOR: "true" },
    );
    assert.deepEqual(writeProd, { ok: true, skipped: false });

    const writeDraft = await upsertSearchIndexVector(
      {
        searchIndexGenerationId: seeded.draft.generation.id,
        chunkId: seeded.draft.chunk.id,
        provider: LOCAL_E5_EMBEDDING_PROVIDER,
        model: DEFAULT_E5_MODEL_ID,
        dimension: DEFAULT_E5_EMBEDDING_DIMENSION,
        contentHash: contentHash(seeded.draft.chunk.content),
        vector: unrelated,
      },
      prisma,
      { NODE_ENV: "test", JYKSTORE_REQUIRE_PGVECTOR: "true" },
    );
    assert.deepEqual(writeDraft, { ok: true, skipped: false });

    const prodHits = await querySearchIndexVectorsByGeneration(
      {
        searchIndexGenerationId: seeded.production.generation.id,
        provider: LOCAL_E5_EMBEDDING_PROVIDER,
        model: DEFAULT_E5_MODEL_ID,
        queryVector: query,
        dimension: DEFAULT_E5_EMBEDDING_DIMENSION,
        limit: 10,
      },
      prisma,
      { NODE_ENV: "test", JYKSTORE_REQUIRE_PGVECTOR: "true" },
    );
    assert.ok(prodHits);
    assert.equal(prodHits.length, 1);
    assert.equal(prodHits[0]?.chunkId, seeded.production.chunk.id);

    const draftHits = await querySearchIndexVectorsByGeneration(
      {
        searchIndexGenerationId: seeded.draft.generation.id,
        provider: LOCAL_E5_EMBEDDING_PROVIDER,
        model: DEFAULT_E5_MODEL_ID,
        queryVector: query,
        dimension: DEFAULT_E5_EMBEDDING_DIMENSION,
        limit: 10,
      },
      prisma,
      { NODE_ENV: "test", JYKSTORE_REQUIRE_PGVECTOR: "true" },
    );
    assert.ok(draftHits);
    assert.equal(draftHits.length, 1);
    assert.equal(draftHits[0]?.chunkId, seeded.draft.chunk.id);
    assert.notEqual(draftHits[0]?.chunkId, prodHits[0]?.chunkId);
  });

  it("rejects NaN vectors and chunk/generation binding mismatches", async () => {
    await assertPgvectorRuntimeReady();
    const suffix = randomUUID().slice(0, 8);
    const seeded = await seedGenerationPair(suffix);

    await assert.rejects(
      () =>
        upsertSearchIndexVector({
          searchIndexGenerationId: seeded.production.generation.id,
          chunkId: seeded.production.chunk.id,
          provider: LOCAL_E5_EMBEDDING_PROVIDER,
          model: DEFAULT_E5_MODEL_ID,
          dimension: DEFAULT_E5_EMBEDDING_DIMENSION,
          contentHash: contentHash("x"),
          vector: Array.from({ length: DEFAULT_E5_EMBEDDING_DIMENSION }, () => Number.NaN),
        }),
      (error: unknown) =>
        isEmbeddingProviderError(error) && error.code === "EMBEDDING_VECTOR_INVALID",
    );

    await assert.rejects(
      () =>
        upsertSearchIndexVector({
          searchIndexGenerationId: seeded.production.generation.id,
          chunkId: seeded.draft.chunk.id,
          provider: LOCAL_E5_EMBEDDING_PROVIDER,
          model: DEFAULT_E5_MODEL_ID,
          dimension: DEFAULT_E5_EMBEDDING_DIMENSION,
          contentHash: contentHash("x"),
          vector: unitVector(2, DEFAULT_E5_EMBEDDING_DIMENSION),
        }),
      (error: unknown) =>
        isEmbeddingProviderError(error) && error.code === "SEARCH_RUNTIME_UNAVAILABLE",
    );
  });
});
