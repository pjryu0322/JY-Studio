/**
 * Search-data stale EMBEDDING recovery (PostgreSQL).
 * Requires DATABASE_URL. Missing DB → suite skipped (never fake PASS).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PackStatus } from "@prisma/client";
import {
  DEFAULT_E5_EMBEDDING_DIMENSION,
  DEFAULT_E5_MODEL_ID,
  LOCAL_E5_EMBEDDING_PROVIDER,
} from "../lib/embedding/e5-embedding-constants.ts";
import { prisma } from "../lib/prisma.ts";
import { recoverOneStaleSearchDataGeneration } from "../lib/search-data/search-data-generation-service.ts";

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

async function seedDraftEmbedding(suffix: string) {
  const packId = `sd-rec-${suffix}`;
  const category =
    (await prisma.packCategory.findFirst({ select: { categoryId: true } })) ??
    (await prisma.packCategory.create({
      data: {
        categoryId: `sd-cat-${suffix}`,
        name: "SD",
        description: "t",
        icon: "book",
      },
    }));
  const user = await prisma.user.create({
    data: { email: `sd-${suffix}@example.com`, name: "SD", accountRole: "PROVIDER" },
  });
  const profile = await prisma.providerProfile.create({
    data: { displayName: "SD", description: "t", userId: user.id, status: "ACTIVE" },
  });
  await prisma.knowledgePack.create({
    data: {
      packId,
      name: "SD Pack",
      categoryId: category.categoryId,
      providerName: "SD",
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
      summary: "sd",
      startedAt: new Date(),
      finishedAt: new Date(),
    },
  });
  const bundle = await prisma.doclingImportBundle.create({
    data: {
      id: `sd-b-${suffix}`,
      packId,
      versionId: version.id,
      status: "REVIEW_READY",
      storageStatus: "ACTIVE",
      isActive: true,
    },
  });
  const normalized = await prisma.normalizedDocument.create({
    data: {
      id: `sd-nd-${suffix}`,
      bundleId: bundle.id,
      packId,
      versionId: version.id,
      adapterVersion: "test",
      fingerprint: `sd-fp-${suffix}`,
      isActive: true,
    },
  });
  const genId = `sd-gen-${suffix}`;
  await prisma.searchIndexGeneration.create({
    data: {
      id: genId,
      packId,
      versionId: version.id,
      pipelineRunId: pipeline.id,
      normalizedDocumentId: normalized.id,
      chunkGenerationId: genId,
      fingerprint: `sd-fp-${suffix}`,
      embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
      embeddingModel: DEFAULT_E5_MODEL_ID,
      embeddingModelRevision: SHA,
      embeddingDimension: DEFAULT_E5_EMBEDDING_DIMENSION,
      distanceMetric: "cosine",
      chunkCount: 3,
      embeddedCount: 1,
      generationFingerprint: `sd-gfp-${suffix}`,
      attempt: 2,
      status: "EMBEDDING",
      scope: "DRAFT",
      startedAt: new Date(),
    },
  });
  return {
    packId,
    genId,
    userId: user.id,
    profileId: profile.id,
    bundleId: bundle.id,
    ndId: normalized.id,
  };
}

async function cleanup(seeded: {
  packId: string;
  genId: string;
  userId: string;
  profileId: string;
  bundleId: string;
  ndId: string;
}) {
  await prisma.$executeRaw`
    DELETE FROM "SearchIndexVector" WHERE "searchIndexGenerationId" = ${seeded.genId}
  `.catch(() => undefined);
  await prisma.knowledgeChunkEmbedding
    .deleteMany({ where: { searchIndexGenerationId: seeded.genId } })
    .catch(() => undefined);
  await prisma.searchIndexGeneration.deleteMany({ where: { id: seeded.genId } }).catch(() => undefined);
  await prisma.normalizedDocument.deleteMany({ where: { id: seeded.ndId } }).catch(() => undefined);
  await prisma.doclingImportBundle.deleteMany({ where: { id: seeded.bundleId } }).catch(() => undefined);
  await prisma.pipelineRun.deleteMany({ where: { packId: seeded.packId } }).catch(() => undefined);
  await prisma.knowledgePackVersion.deleteMany({ where: { packId: seeded.packId } }).catch(() => undefined);
  await prisma.knowledgePack.deleteMany({ where: { packId: seeded.packId } }).catch(() => undefined);
  await prisma.providerProfile.deleteMany({ where: { id: seeded.profileId } }).catch(() => undefined);
  await prisma.user.deleteMany({ where: { id: seeded.userId } }).catch(() => undefined);
}

describe("search-data worker recovery (skipped without DATABASE_URL)", { skip: !hasDb }, () => {
  it("does not recover recent EMBEDDING", async () => {
    const suffix = randomUUID().slice(0, 8);
    const seeded = await seedDraftEmbedding(suffix);
    try {
      await prisma.$executeRaw`
        UPDATE "SearchIndexGeneration"
        SET "updatedAt" = NOW(), "status" = 'EMBEDDING'::"SearchIndexGenerationStatus"
        WHERE id = ${seeded.genId}
      `;
      const recovered = await recoverOneStaleSearchDataGeneration(300);
      const ours = await prisma.searchIndexGeneration.findUnique({ where: { id: seeded.genId } });
      assert.ok(ours);
      if (!recovered || recovered.id !== seeded.genId) {
        assert.equal(ours!.status, "EMBEDDING");
        assert.equal(ours!.attempt, 2);
      } else {
        // Unlikely for fresh updatedAt; if recovered somehow, fail loudly.
        assert.fail("recent EMBEDDING must not be recovered");
      }
    } finally {
      await cleanup(seeded);
    }
  });

  it("recovers stale EMBEDDING to PENDING with attempt bump", async () => {
    const suffix = randomUUID().slice(0, 8);
    const seeded = await seedDraftEmbedding(suffix);
    try {
      const old = new Date(Date.now() - 10 * 60 * 1000);
      await prisma.$executeRaw`
        UPDATE "SearchIndexGeneration"
        SET "updatedAt" = ${old}, "status" = 'EMBEDDING'::"SearchIndexGenerationStatus"
        WHERE id = ${seeded.genId}
      `;

      let recovered = await recoverOneStaleSearchDataGeneration(60);
      for (let i = 0; i < 30 && recovered && recovered.id !== seeded.genId; i += 1) {
        recovered = await recoverOneStaleSearchDataGeneration(60);
      }
      assert.ok(recovered && recovered.id === seeded.genId, "expected our generation to be recovered");
      assert.equal(recovered!.previousAttempt, 2);
      assert.equal(recovered!.attempt, 3);

      const ours = await prisma.searchIndexGeneration.findUnique({ where: { id: seeded.genId } });
      assert.equal(ours?.status, "PENDING");
      assert.equal(ours?.embeddedCount, 0);
      assert.equal(ours?.failureCode, null);
    } finally {
      await cleanup(seeded);
    }
  });

  it("concurrent recover claims the same generation only once", async () => {
    const suffix = randomUUID().slice(0, 8);
    const seeded = await seedDraftEmbedding(suffix);
    try {
      const old = new Date(Date.now() - 10 * 60 * 1000);
      await prisma.$executeRaw`
        UPDATE "SearchIndexGeneration"
        SET "updatedAt" = ${old}, "status" = 'EMBEDDING'::"SearchIndexGenerationStatus", attempt = 2
        WHERE id = ${seeded.genId}
      `;

      const [a, b] = await Promise.all([
        recoverOneStaleSearchDataGeneration(60),
        recoverOneStaleSearchDataGeneration(60),
      ]);
      const oursHits = [a, b].filter((r) => r && r.id === seeded.genId);
      // Drain unrelated stale jobs then ensure ours ended PENDING with attempt 3
      let drain = await recoverOneStaleSearchDataGeneration(60);
      for (let i = 0; i < 20 && drain; i += 1) {
        drain = await recoverOneStaleSearchDataGeneration(60);
      }
      const ours = await prisma.searchIndexGeneration.findUnique({ where: { id: seeded.genId } });
      assert.equal(ours?.status, "PENDING");
      assert.equal(ours?.attempt, 3);
      assert.ok(oursHits.length <= 1 || oursHits.every((h) => h!.attempt === 3));
    } finally {
      await cleanup(seeded);
    }
  });

  it("previous attempt cannot fail a recovered generation", async () => {
    const suffix = randomUUID().slice(0, 8);
    const seeded = await seedDraftEmbedding(suffix);
    try {
      const old = new Date(Date.now() - 10 * 60 * 1000);
      await prisma.$executeRaw`
        UPDATE "SearchIndexGeneration"
        SET "updatedAt" = ${old}, "status" = 'EMBEDDING'::"SearchIndexGenerationStatus", attempt = 2
        WHERE id = ${seeded.genId}
      `;
      let recovered = await recoverOneStaleSearchDataGeneration(60);
      for (let i = 0; i < 30 && recovered && recovered.id !== seeded.genId; i += 1) {
        recovered = await recoverOneStaleSearchDataGeneration(60);
      }
      assert.ok(recovered?.id === seeded.genId);

      const { markSearchGenerationFailed } = await import(
        "../lib/search-generation/search-generation-service.ts"
      );
      await assert.rejects(
        () =>
          markSearchGenerationFailed(seeded.genId, {
            failureCode: "INDEX_BUILD_FAILED",
            expectedAttempt: 2,
          }),
        /충돌|TRANSITION|attempt/i,
      );

      const ours = await prisma.searchIndexGeneration.findUnique({ where: { id: seeded.genId } });
      assert.equal(ours?.status, "PENDING");
      assert.equal(ours?.attempt, 3);
    } finally {
      await cleanup(seeded);
    }
  });
});
