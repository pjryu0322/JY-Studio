/**
 * P8.2.3 — Published serving lifecycle: Unpublish blocks public/MCP retrieval
 * without deleting generations; restoring PUBLISHED reuses the same PRODUCTION generation.
 *
 * Does not add a /republish API — restore uses status-only recovery because
 * approvePackReview requires REVIEWING and cannot republish an already-PROMOTED pack.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PackStatus } from "@prisma/client";
import {
  DEFAULT_E5_EMBEDDING_DIMENSION,
  DEFAULT_E5_MODEL_ID,
  LOCAL_E5_EMBEDDING_PROVIDER,
} from "../lib/embedding/e5-embedding-constants.ts";
import { unpublishPackReview } from "../lib/admin-review-service.ts";
import { prisma } from "../lib/prisma.ts";
import { executeRetrievalApiRequest } from "../lib/retrieval/retrieval-api-adapter.ts";
import { loadPublicRetrievalPack } from "../lib/retrieval/retrieval-pack-store.ts";
import { resolvePublicRetrievalGenerationScope } from "../lib/retrieval/retrieval-generation-scope.ts";

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

async function seedLifecycleFixture(suffix: string) {
  const packId = `p823-pack-${suffix}`;
  const category =
    (await prisma.packCategory.findFirst({ select: { categoryId: true } })) ??
    (await prisma.packCategory.create({
      data: {
        categoryId: `p823-cat-${suffix}`,
        name: "P823",
        description: "t",
        icon: "book",
      },
    }));
  const user = await prisma.user.create({
    data: { email: `p823-${suffix}@example.com`, name: "P823", accountRole: "PROVIDER" },
  });
  const profile = await prisma.providerProfile.create({
    data: { displayName: "P823", description: "t", userId: user.id, status: "ACTIVE" },
  });
  await prisma.knowledgePack.create({
    data: {
      packId,
      name: "P823 Pack",
      categoryId: category.categoryId,
      providerName: "P823",
      providerType: "COMMUNITY",
      status: PackStatus.PUBLISHED,
      publishedAt: new Date(),
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
      summary: "p823",
      startedAt: new Date(),
      finishedAt: new Date(),
    },
  });
  const bundle = await prisma.doclingImportBundle.create({
    data: {
      id: `p823-b-${suffix}`,
      packId,
      versionId: version.id,
      status: "REVIEW_READY",
      storageStatus: "ACTIVE",
      isActive: true,
    },
  });
  const normalized = await prisma.normalizedDocument.create({
    data: {
      id: `p823-nd-${suffix}`,
      bundleId: bundle.id,
      packId,
      versionId: version.id,
      adapterVersion: "test",
      fingerprint: `p823-fp-${suffix}`,
      isActive: true,
    },
  });
  const source = await prisma.sourceDocument.create({
    data: {
      id: `p823-src-${suffix}`,
      versionId: version.id,
      title: "SpanMergingField",
      content: "cell merge api",
    },
  });

  async function createGeneration(scope: "DRAFT" | "PRODUCTION", status: "READY" | "PROMOTED") {
    return prisma.searchIndexGeneration.create({
      data: {
        id: `p823-gen-${suffix}-${scope.toLowerCase()}`,
        packId,
        versionId: version.id,
        pipelineRunId: pipeline.id,
        normalizedDocumentId: normalized.id,
        chunkGenerationId: `p823-cg-${suffix}-${scope.toLowerCase()}`,
        fingerprint: `p823-gfp-${suffix}-${scope}`,
        embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
        embeddingModel: DEFAULT_E5_MODEL_ID,
        embeddingModelRevision: SHA,
        embeddingDimension: DEFAULT_E5_EMBEDDING_DIMENSION,
        distanceMetric: "cosine",
        status,
        scope,
        generationFingerprint: `p823-gf-${suffix}-${scope}`,
        chunkCount: 1,
        embeddedCount: 1,
        promotedAt: status === "PROMOTED" ? new Date() : null,
      },
    });
  }

  const draft = await createGeneration("DRAFT", "READY");
  const production = await createGeneration("PRODUCTION", "PROMOTED");
  await prisma.knowledgeChunk.create({
    data: {
      id: `p823-chunk-${suffix}`,
      versionId: version.id,
      sourceDocumentId: source.id,
      chunkType: "retrieval",
      title: "SpanMergingField",
      content: "SpanMergingField merges adjacent equal cell values in DataGrid",
      tags: [],
      chunkGenerationId: production.chunkGenerationId,
      metadata: {
        indexGenerationId: production.chunkGenerationId,
        searchIndexGenerationId: production.id,
        sourcePath: "Docs/api/SpanMergingField.html",
      },
      isActive: true,
    },
  });

  return {
    packId,
    versionId: version.id,
    sourceId: source.id,
    draftId: draft.id,
    productionId: production.id,
    async cleanup() {
      await prisma.knowledgeChunk.deleteMany({ where: { versionId: version.id } }).catch(() => undefined);
      await prisma.searchIndexGeneration.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.sourceDocument.deleteMany({ where: { versionId: version.id } }).catch(() => undefined);
      await prisma.normalizedDocument.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.doclingImportBundle.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.pipelineRun.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.packDistributionMetadata.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.knowledgePackVersion.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.auditLog.deleteMany({ where: { entityId: packId } }).catch(() => undefined);
      await prisma.knowledgePack.delete({ where: { packId } }).catch(() => undefined);
      await prisma.providerProfile.delete({ where: { id: profile.id } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    },
  };
}

describe("P8.2.3 published serving lifecycle (skipped without DATABASE_URL)", {
  skip: !hasDb,
}, () => {
  const cleanups: Array<() => Promise<void>> = [];
  after(async () => {
    for (const fn of cleanups.reverse()) await fn();
  });

  it("unpublish blocks public retrieval without deleting generations; restore reuses PRODUCTION", async () => {
    const suffix = randomUUID().slice(0, 8);
    const seeded = await seedLifecycleFixture(suffix);
    cleanups.push(seeded.cleanup);

    const beforePack = await loadPublicRetrievalPack(seeded.packId);
    assert.ok(beforePack);
    const beforeScope = await resolvePublicRetrievalGenerationScope(seeded.versionId);
    assert.equal(beforeScope.searchIndexGenerationId, seeded.productionId);

    const publishedQuery = await executeRetrievalApiRequest({
      knowledgePackId: seeded.packId,
      query: "SpanMergingField merge cells",
      topK: 3,
      retrievalMode: "keyword",
      requestId: `req_p823_pub_${suffix}`,
      serviceChannel: "MCP",
      executionMode: "PUBLIC",
    });
    assert.equal(publishedQuery.ok, true);
    if (publishedQuery.ok) {
      assert.ok(publishedQuery.data.contexts.length >= 1);
      assert.equal(publishedQuery.data.contexts[0]?.knowledgePackId, seeded.packId);
    }

    const genCountBefore = await prisma.searchIndexGeneration.count({
      where: { packId: seeded.packId },
    });
    const sourceCountBefore = await prisma.sourceDocument.count({
      where: { id: seeded.sourceId },
    });

    const unpublish = await unpublishPackReview({
      packId: seeded.packId,
      memo: "P8.2.3 lifecycle regression",
    });
    assert.ok(!("error" in unpublish && unpublish.error));

    const afterUnpublish = await prisma.knowledgePack.findUnique({
      where: { packId: seeded.packId },
      select: { status: true },
    });
    assert.equal(afterUnpublish?.status, PackStatus.DRAFT);
    assert.equal(await loadPublicRetrievalPack(seeded.packId), null);

    const blocked = await executeRetrievalApiRequest({
      knowledgePackId: seeded.packId,
      query: "SpanMergingField merge cells",
      topK: 3,
      retrievalMode: "keyword",
      requestId: `req_p823_block_${suffix}`,
      serviceChannel: "MCP",
      executionMode: "PUBLIC",
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(blocked.code, "PACK_NOT_FOUND");
    }

    const genCountAfter = await prisma.searchIndexGeneration.count({
      where: { packId: seeded.packId },
    });
    assert.equal(genCountAfter, genCountBefore);
    const productionStill = await prisma.searchIndexGeneration.findUnique({
      where: { id: seeded.productionId },
      select: { id: true, scope: true, status: true },
    });
    assert.deepEqual(productionStill, {
      id: seeded.productionId,
      scope: "PRODUCTION",
      status: "PROMOTED",
    });
    const draftStill = await prisma.searchIndexGeneration.findUnique({
      where: { id: seeded.draftId },
      select: { scope: true, status: true },
    });
    assert.deepEqual(draftStill, { scope: "DRAFT", status: "READY" });
    assert.equal(
      await prisma.sourceDocument.count({ where: { id: seeded.sourceId } }),
      sourceCountBefore,
    );

    await prisma.knowledgePack.update({
      where: { packId: seeded.packId },
      data: { status: PackStatus.PUBLISHED, publishedAt: new Date() },
    });

    const restoredPack = await loadPublicRetrievalPack(seeded.packId);
    assert.ok(restoredPack);
    const restoredScope = await resolvePublicRetrievalGenerationScope(seeded.versionId);
    assert.equal(restoredScope.searchIndexGenerationId, seeded.productionId);

    const restoredQuery = await executeRetrievalApiRequest({
      knowledgePackId: seeded.packId,
      query: "SpanMergingField merge cells",
      topK: 3,
      retrievalMode: "keyword",
      requestId: `req_p823_restored_${suffix}`,
      serviceChannel: "MCP",
      executionMode: "PUBLIC",
    });
    assert.equal(restoredQuery.ok, true);
    if (restoredQuery.ok) {
      assert.ok(restoredQuery.data.contexts.length >= 1);
      assert.equal(restoredQuery.data.contexts[0]?.knowledgePackId, seeded.packId);
    }
  });
});
