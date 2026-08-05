/**
 * P9.1 — Restore Existing vs New Revision Publish separation + identity invariants.
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
import {
  publishNewRevisionAfterUnpublish,
  restorePublishedPackAfterUnpublish,
  unpublishPackReview,
} from "../lib/admin-review-service.ts";
import { prisma } from "../lib/prisma.ts";
import { executeRetrievalApiRequest } from "../lib/retrieval/retrieval-api-adapter.ts";
import { loadPublicRetrievalPack } from "../lib/retrieval/retrieval-pack-store.ts";
import { resolvePublicRetrievalGenerationScope } from "../lib/retrieval/retrieval-generation-scope.ts";
import {
  STORE_PROVIDER_REVIEW_TRIGGER,
  STORE_SERVICE_VALIDATION_TRIGGER,
} from "../lib/store-workflow-markers.ts";
import { encodeProviderReviewConfirmSummary } from "../lib/store-workflow-provider-review-binding.ts";
import { resolvePublishRecoveryForPack } from "../lib/workflow/publish-recovery.ts";

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
const SHA = "fcfc26bf355882620c48df58be112275bd756f50";

async function requireDb(t: { skip: (msg?: string) => void }): Promise<boolean> {
  const { requirePostgres } = await import("./helpers/db-gate.ts");
  const client = await requirePostgres(t, prisma);
  return Boolean(client);
}

async function seedPublishedPack(suffix: string) {
  const packId = `p91-pack-${suffix}`;
  const category =
    (await prisma.packCategory.findFirst({ select: { categoryId: true } })) ??
    (await prisma.packCategory.create({
      data: {
        categoryId: `p91-cat-${suffix}`,
        name: "P91",
        description: "t",
        icon: "book",
      },
    }));
  const user = await prisma.user.create({
    data: { email: `p91-${suffix}@example.com`, name: "P91", accountRole: "PROVIDER" },
  });
  const profile = await prisma.providerProfile.create({
    data: { displayName: "P91", description: "t", userId: user.id, status: "ACTIVE" },
  });
  await prisma.knowledgePack.create({
    data: {
      packId,
      name: "P91 Pack",
      categoryId: category.categoryId,
      providerName: "P91",
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
      triggerType: "WORKER_ZIP_IMPORT",
      status: "PASS",
      summary: "p91",
      startedAt: new Date(),
      finishedAt: new Date(),
    },
  });
  const bundle = await prisma.doclingImportBundle.create({
    data: {
      id: `p91-b-${suffix}`,
      packId,
      versionId: version.id,
      status: "REVIEW_READY",
      storageStatus: "ACTIVE",
      isActive: true,
    },
  });
  const normalized = await prisma.normalizedDocument.create({
    data: {
      id: `p91-nd-${suffix}`,
      bundleId: bundle.id,
      packId,
      versionId: version.id,
      adapterVersion: "test",
      fingerprint: `p91-fp-${suffix}`,
      isActive: true,
    },
  });
  const source = await prisma.sourceDocument.create({
    data: {
      id: `p91-src-${suffix}`,
      versionId: version.id,
      title: "SpanMergingField",
      content: "cell merge api",
    },
  });

  async function createGeneration(
    scope: "DRAFT" | "PRODUCTION",
    status: "READY" | "PROMOTED",
    tag: string,
  ) {
    return prisma.searchIndexGeneration.create({
      data: {
        id: `p91-gen-${suffix}-${tag}`,
        packId,
        versionId: version.id,
        pipelineRunId: pipeline.id,
        normalizedDocumentId: normalized.id,
        chunkGenerationId: `p91-cg-${suffix}-${tag}`,
        fingerprint: `p91-gfp-${suffix}-${tag}`,
        embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
        embeddingModel: DEFAULT_E5_MODEL_ID,
        embeddingModelRevision: SHA,
        embeddingDimension: DEFAULT_E5_EMBEDDING_DIMENSION,
        distanceMetric: "cosine",
        status,
        scope,
        generationFingerprint: `p91-gf-${suffix}-${tag}`,
        chunkCount: 1,
        embeddedCount: 1,
        promotedAt: status === "PROMOTED" ? new Date() : null,
      },
    });
  }

  const production = await createGeneration("PRODUCTION", "PROMOTED", "prod-a");
  await prisma.knowledgeChunk.create({
    data: {
      id: `p91-chunk-${suffix}`,
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
    productionId: production.id,
    pipelineId: pipeline.id,
    normalizedId: normalized.id,
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

describe("P9.1 publish revision identity", {
  skip: !Boolean(process.env.DATABASE_URL?.trim()) && process.env.JYKSTORE_DB_TESTS !== "1",
}, () => {
  const cleanups: Array<() => Promise<void>> = [];
  after(async () => {
    for (const fn of cleanups.reverse()) await fn();
  });

  it("Case A: Restore Existing resumes preserved PRODUCTION A (no new draft)", async (t) => {
    if (!(await requireDb(t))) return;
    const suffix = randomUUID().slice(0, 8);
    const seeded = await seedPublishedPack(suffix);
    cleanups.push(seeded.cleanup);

    const unpublish = await unpublishPackReview({
      packId: seeded.packId,
      memo: "P9.1 case A",
    });
    assert.ok(!("error" in unpublish && unpublish.error));
    assert.equal(unpublish.preservedGenerationId, seeded.productionId);
    assert.equal(await loadPublicRetrievalPack(seeded.packId), null);

    const recovery = await resolvePublishRecoveryForPack(seeded.packId);
    assert.equal(recovery.mode, "RESTORE_EXISTING");
    assert.equal(recovery.preservedGenerationId, seeded.productionId);

    const restore = await restorePublishedPackAfterUnpublish({
      packId: seeded.packId,
      memo: "restore A",
    });
    assert.ok(!("error" in restore && restore.error), JSON.stringify(restore));
    assert.equal(restore.restoredGenerationId, seeded.productionId);
    assert.equal(restore.status, PackStatus.PUBLISHED);

    const scope = await resolvePublicRetrievalGenerationScope(seeded.versionId);
    assert.equal(scope.searchIndexGenerationId, seeded.productionId);
    const pack = await loadPublicRetrievalPack(seeded.packId);
    assert.ok(pack);
    assert.equal(pack!.versionId, seeded.versionId);

    const query = await executeRetrievalApiRequest({
      knowledgePackId: seeded.packId,
      query: "SpanMergingField merge cells",
      topK: 3,
      retrievalMode: "keyword",
      requestId: `req_p91_a_${suffix}`,
      serviceChannel: "MCP",
      executionMode: "PUBLIC",
    });
    assert.equal(query.ok, true);
  });

  it("Case B: Draft B after unpublish blocks Restore A; New Revision Publish serves B", async (t) => {
    if (!(await requireDb(t))) return;
    const suffix = randomUUID().slice(0, 8);
    const seeded = await seedPublishedPack(suffix);
    cleanups.push(seeded.cleanup);

    await unpublishPackReview({ packId: seeded.packId, memo: "P9.1 case B" });

    // Create new DRAFT READY B after unpublish + provider review binding to B.
    const draftB = await prisma.searchIndexGeneration.create({
      data: {
        id: `p91-gen-${suffix}-draft-b`,
        packId: seeded.packId,
        versionId: seeded.versionId,
        pipelineRunId: seeded.pipelineId,
        normalizedDocumentId: seeded.normalizedId,
        chunkGenerationId: `p91-cg-${suffix}-draft-b`,
        fingerprint: `p91-gfp-${suffix}-draft-b`,
        embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
        embeddingModel: DEFAULT_E5_MODEL_ID,
        embeddingModelRevision: SHA,
        embeddingDimension: DEFAULT_E5_EMBEDDING_DIMENSION,
        distanceMetric: "cosine",
        status: "READY",
        scope: "DRAFT",
        generationFingerprint: `p91-gf-${suffix}-draft-b`,
        chunkCount: 1,
        embeddedCount: 1,
      },
    });
    assert.notEqual(draftB.id, seeded.productionId);

    await prisma.pipelineRun.create({
      data: {
        packId: seeded.packId,
        triggerType: STORE_SERVICE_VALIDATION_TRIGGER,
        status: "PASS",
        summary: "SV for B",
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });
    await prisma.pipelineRun.create({
      data: {
        packId: seeded.packId,
        triggerType: STORE_PROVIDER_REVIEW_TRIGGER,
        status: "PASS",
        summary: encodeProviderReviewConfirmSummary({
          v: 1,
          indexGenerationId: draftB.id,
          versionId: seeded.versionId,
          pipelineRunId: seeded.pipelineId,
          reviewedAt: new Date().toISOString(),
          reviewerClientId: "p91-b",
        }),
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });

    const recovery = await resolvePublishRecoveryForPack(seeded.packId);
    assert.equal(recovery.mode, "PUBLISH_NEW_REVISION");
    assert.equal(recovery.code, "NEW_REVISION_PENDING");

    const blocked = await restorePublishedPackAfterUnpublish({
      packId: seeded.packId,
      memo: "should block — would serve A with B review",
    });
    assert.equal(blocked.error, "INCOMPLETE");
    assert.equal(blocked.code, "NEW_REVISION_PENDING");

    const published = await publishNewRevisionAfterUnpublish({
      packId: seeded.packId,
      memo: "publish B",
    });
    assert.ok(!("error" in published && published.error), JSON.stringify(published));
    assert.equal(published.reviewedGenerationId, draftB.id);
    assert.equal(published.publishedGenerationId, draftB.id);
    assert.equal(published.servedGenerationId, draftB.id);

    const prod = await prisma.searchIndexGeneration.findUnique({
      where: { id: draftB.id },
      select: { scope: true, status: true },
    });
    assert.deepEqual(prod, { scope: "PRODUCTION", status: "PROMOTED" });

    const retiredA = await prisma.searchIndexGeneration.findUnique({
      where: { id: seeded.productionId },
      select: { status: true },
    });
    assert.equal(retiredA?.status, "RETIRED");

    const scope = await resolvePublicRetrievalGenerationScope(seeded.versionId);
    assert.equal(scope.searchIndexGenerationId, draftB.id);
    assert.notEqual(scope.searchIndexGenerationId, seeded.productionId);
  });
});
