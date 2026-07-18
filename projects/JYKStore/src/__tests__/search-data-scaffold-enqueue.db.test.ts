/**
 * Scaffold enqueue + claim gating (PostgreSQL).
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
import { claimNextSearchDataGeneration } from "../lib/search-data/search-data-generation-service.ts";

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

async function seedScaffold(suffix: string, attempt: number) {
  const packId = `sd-scaf-${suffix}`;
  const category =
    (await prisma.packCategory.findFirst({ select: { categoryId: true } })) ??
    (await prisma.packCategory.create({
      data: {
        categoryId: `sd-scaf-cat-${suffix}`,
        name: "SD",
        description: "t",
        icon: "book",
      },
    }));
  const user = await prisma.user.create({
    data: { email: `sd-scaf-${suffix}@example.com`, name: "SD", accountRole: "PROVIDER" },
  });
  const profile = await prisma.providerProfile.create({
    data: { displayName: "SD", description: "t", userId: user.id, status: "ACTIVE" },
  });
  await prisma.knowledgePack.create({
    data: {
      packId,
      name: "SD Scaffold",
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
      triggerType: "DOCLING_KNOWLEDGE_GENERATION",
      status: "PASS",
      summary: "sd",
      startedAt: new Date(),
      finishedAt: new Date(),
    },
  });
  const bundle = await prisma.doclingImportBundle.create({
    data: {
      id: `sd-scaf-b-${suffix}`,
      packId,
      versionId: version.id,
      status: "REVIEW_READY",
      storageStatus: "ACTIVE",
      isActive: true,
    },
  });
  const normalized = await prisma.normalizedDocument.create({
    data: {
      id: `sd-scaf-nd-${suffix}`,
      bundleId: bundle.id,
      packId,
      versionId: version.id,
      adapterVersion: "test",
      fingerprint: `sd-scaf-fp-${suffix}`,
      isActive: true,
    },
  });
  const genId = `sd-scaf-gen-${suffix}`;
  await prisma.searchIndexGeneration.create({
    data: {
      id: genId,
      packId,
      versionId: version.id,
      pipelineRunId: pipeline.id,
      normalizedDocumentId: normalized.id,
      chunkGenerationId: genId,
      fingerprint: `sd-scaf-fp-${suffix}`,
      embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
      embeddingModel: DEFAULT_E5_MODEL_ID,
      embeddingModelRevision: SHA,
      embeddingDimension: DEFAULT_E5_EMBEDDING_DIMENSION,
      distanceMetric: "cosine",
      chunkCount: 89,
      embeddedCount: 0,
      generationFingerprint: `sd-scaf-gfp-${suffix}`,
      attempt,
      status: "PENDING",
      scope: "DRAFT",
    },
  });
  return {
    packId,
    genId,
    pipelineId: pipeline.id,
    fingerprint: `sd-scaf-fp-${suffix}`,
    ndId: normalized.id,
    userId: user.id,
    profileId: profile.id,
    bundleId: bundle.id,
    versionId: version.id,
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

describe("search-data scaffold enqueue/claim (DB)", { skip: !hasDb }, () => {
  it("does not claim PENDING attempt=0 scaffold", async () => {
    const suffix = randomUUID().slice(0, 8);
    const seeded = await seedScaffold(suffix, 0);
    try {
      // Drain other claimable rows first by claiming until we get ours or null repeatedly.
      for (let i = 0; i < 20; i++) {
        const claimed = await claimNextSearchDataGeneration();
        if (!claimed) break;
        if (claimed.id === seeded.genId) {
          assert.fail("attempt=0 scaffold must not be claimable");
        }
        // Release foreign claim back to PENDING so we do not leave orphan EMBEDDING.
        await prisma.searchIndexGeneration.updateMany({
          where: { id: claimed.id, attempt: claimed.attempt, status: "EMBEDDING" },
          data: { status: "PENDING", startedAt: null },
        });
      }
      const ours = await prisma.searchIndexGeneration.findUnique({ where: { id: seeded.genId } });
      assert.equal(ours?.status, "PENDING");
      assert.equal(ours?.attempt, 0);
    } finally {
      await cleanup(seeded);
    }
  });

  it("atomically enqueues attempt 0→1 and then allows claim", async () => {
    const suffix = randomUUID().slice(0, 8);
    const seeded = await seedScaffold(suffix, 0);
    try {
      const updated = await prisma.searchIndexGeneration.updateMany({
        where: {
          id: seeded.genId,
          scope: "DRAFT",
          status: "PENDING",
          attempt: 0,
          chunkGenerationId: seeded.genId,
          pipelineRunId: seeded.pipelineId,
          normalizedDocumentId: seeded.ndId,
          fingerprint: seeded.fingerprint,
        },
        data: {
          attempt: 1,
          embeddedCount: 0,
          failedCount: 0,
          failureCode: null,
          failureMessage: null,
          startedAt: null,
        },
      });
      assert.equal(updated.count, 1);

      const concurrent = await prisma.searchIndexGeneration.updateMany({
        where: {
          id: seeded.genId,
          scope: "DRAFT",
          status: "PENDING",
          attempt: 0,
        },
        data: { attempt: 1 },
      });
      assert.equal(concurrent.count, 0, "second enqueue must not bump attempt again");

      const after = await prisma.searchIndexGeneration.findUnique({ where: { id: seeded.genId } });
      assert.equal(after?.attempt, 1);
      assert.equal(after?.status, "PENDING");

      let claimedOurs = false;
      for (let i = 0; i < 30; i++) {
        const claimed = await claimNextSearchDataGeneration();
        if (!claimed) break;
        if (claimed.id === seeded.genId) {
          claimedOurs = true;
          assert.equal(claimed.attempt, 1);
          const row = await prisma.searchIndexGeneration.findUnique({ where: { id: seeded.genId } });
          assert.equal(row?.status, "EMBEDDING");
          break;
        }
        await prisma.searchIndexGeneration.updateMany({
          where: { id: claimed.id, attempt: claimed.attempt, status: "EMBEDDING" },
          data: { status: "PENDING", startedAt: null },
        });
      }
      assert.equal(claimedOurs, true);
    } finally {
      await cleanup(seeded);
    }
  });

  it("concurrent claim of attempt=1 succeeds only once", async () => {
    const suffix = randomUUID().slice(0, 8);
    const seeded = await seedScaffold(suffix, 1);
    try {
      // Isolate: mark other PENDING attempt>0 as FAILED temporarily is too invasive.
      // Instead claim twice on the same gen after ensuring ours is oldest claimable.
      await prisma.searchIndexGeneration.update({
        where: { id: seeded.genId },
        data: { createdAt: new Date(0) },
      });
      const [a, b] = await Promise.all([
        claimNextSearchDataGeneration(),
        claimNextSearchDataGeneration(),
      ]);
      const ours = [a, b].filter((c) => c?.id === seeded.genId);
      assert.ok(ours.length <= 1, "same generation claimed at most once");
      if (ours.length === 1) {
        const row = await prisma.searchIndexGeneration.findUnique({ where: { id: seeded.genId } });
        assert.equal(row?.status, "EMBEDDING");
      }
      for (const c of [a, b]) {
        if (c && c.id !== seeded.genId) {
          await prisma.searchIndexGeneration.updateMany({
            where: { id: c.id, attempt: c.attempt, status: "EMBEDDING" },
            data: { status: "PENDING", startedAt: null },
          });
        }
      }
    } finally {
      await cleanup(seeded);
    }
  });
});

if (!hasDb) {
  console.warn("DB tests: SKIPPED — DATABASE_URL not configured");
}
