/**
 * Scaffold enqueue + claim (PostgreSQL isolated test DB only).
 *
 * Requires:
 *   JYKSTORE_DB_TESTS=1
 *   DATABASE_URL path containing "test" (e.g. .../jykstore_test)
 *
 * Never runs against a shared/dev database (avoids claiming foreign generations).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PackStatus, PipelineStatus } from "@prisma/client";
import {
  createKnowledgeRunBinding,
  serializeKnowledgeRunBinding,
} from "../lib/docling-knowledge/docling-knowledge-run-binding.ts";
import { DOCLING_KNOWLEDGE_PIPELINE_TRIGGER, DOCLING_RETRIEVAL_CHUNK_TYPE } from "../lib/docling-knowledge/docling-knowledge-stages.ts";
import {
  DEFAULT_E5_EMBEDDING_DIMENSION,
  DEFAULT_E5_MODEL_ID,
  LOCAL_E5_EMBEDDING_PROVIDER,
} from "../lib/embedding/e5-embedding-constants.ts";
import { prisma } from "../lib/prisma.ts";
import {
  claimNextSearchDataGeneration,
  startSearchDataGeneration,
} from "../lib/search-data/search-data-generation-service.ts";

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

function isIsolatedTestDatabase(): boolean {
  if (process.env.JYKSTORE_DB_TESTS !== "1") return false;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return false;
  try {
    return /test/i.test(new URL(url).pathname);
  } catch {
    return /test/i.test(url);
  }
}

const runDb = isIsolatedTestDatabase();
const SHA = "fcfc26bf355882620c48df58be112275bd756f50";

if (!runDb) {
  console.warn(
    "DB tests: SKIPPED — set JYKSTORE_DB_TESTS=1 and use a DATABASE_URL whose path contains 'test'",
  );
}

async function seedStructureScaffold(suffix: string) {
  const packId = `sd-svc-${suffix}`;
  const clientId = `client-${suffix}`;
  const category =
    (await prisma.packCategory.findFirst({ select: { categoryId: true } })) ??
    (await prisma.packCategory.create({
      data: {
        categoryId: `sd-svc-cat-${suffix}`,
        name: "SD",
        description: "t",
        icon: "book",
      },
    }));
  const user = await prisma.user.create({
    data: {
      email: `sd-svc-${suffix}@example.com`,
      name: "SD",
      accountRole: "PROVIDER",
    },
  });
  const profile = await prisma.providerProfile.create({
    data: {
      displayName: "SD",
      description: "t",
      userId: user.id,
      clientId,
      status: "ACTIVE",
    },
  });
  await prisma.knowledgePack.create({
    data: {
      packId,
      name: "SD Service Pack",
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
  const bundle = await prisma.doclingImportBundle.create({
    data: {
      id: `sd-svc-b-${suffix}`,
      packId,
      versionId: version.id,
      status: "REVIEW_READY",
      storageStatus: "ACTIVE",
      isActive: true,
    },
  });
  const fingerprint = `sd-svc-fp-${suffix}`;
  const normalized = await prisma.normalizedDocument.create({
    data: {
      id: `sd-svc-nd-${suffix}`,
      bundleId: bundle.id,
      packId,
      versionId: version.id,
      adapterVersion: "test",
      fingerprint,
      isActive: true,
      title: "t",
    },
  });
  const genId = `sd-svc-gen-${suffix}`;
  const binding = createKnowledgeRunBinding({
    versionId: version.id,
    normalizedDocumentId: normalized.id,
    fingerprint,
    bundleId: bundle.id,
    indexGenerationId: genId,
    requestedByUserId: user.id,
    requestedByClientId: clientId,
  });
  const pipeline = await prisma.pipelineRun.create({
    data: {
      packId,
      triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
      status: "PASS",
      summary: serializeKnowledgeRunBinding(binding),
      startedAt: new Date(),
      finishedAt: new Date(),
    },
  });
  for (const step of [
    { step: "STRUCTURE_VALIDATING" as PipelineStatus, status: "PASS" as const, details: { advisory: true } },
    { step: "KNOWLEDGE_CHECKING" as PipelineStatus, status: "PASS" as const, details: { unitCount: 1 } },
    {
      step: "CHUNKING" as PipelineStatus,
      status: "PASS" as const,
      details: { chunkCount: 2, tokenGateStatus: "PASS", hardLimitExceededCount: 0 },
    },
  ]) {
    await prisma.pipelineStep.create({
      data: {
        runId: pipeline.id,
        packId,
        step: step.step,
        status: step.status,
        message: "ok",
        details: step.details,
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });
  }
  await prisma.searchIndexGeneration.create({
    data: {
      id: genId,
      packId,
      versionId: version.id,
      pipelineRunId: pipeline.id,
      normalizedDocumentId: normalized.id,
      chunkGenerationId: genId,
      fingerprint,
      embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
      embeddingModel: DEFAULT_E5_MODEL_ID,
      embeddingModelRevision: SHA,
      embeddingDimension: DEFAULT_E5_EMBEDDING_DIMENSION,
      distanceMetric: "cosine",
      chunkCount: 2,
      embeddedCount: 0,
      generationFingerprint: `sd-svc-gfp-${suffix}`,
      attempt: 0,
      status: "PENDING",
      scope: "DRAFT",
    },
  });
  for (let i = 0; i < 2; i++) {
    await prisma.knowledgeChunk.create({
      data: {
        versionId: version.id,
        chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
        title: `c${i}`,
        content: `chunk content ${i} `.repeat(20),
        section: "s",
        tags: [],
        sortOrder: i,
        isActive: false,
        chunkGenerationId: genId,
        metadata: {
          indexGenerationId: genId,
          generatedBy: "docling-knowledge-pipeline",
        },
      },
    });
  }
  return {
    packId,
    genId,
    userId: user.id,
    clientId,
    profileId: profile.id,
    bundleId: bundle.id,
    ndId: normalized.id,
    versionId: version.id,
    pipelineId: pipeline.id,
    fingerprint,
    descriptor: {
      embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
      embeddingModel: DEFAULT_E5_MODEL_ID,
      embeddingModelRevision: SHA,
      embeddingDimension: DEFAULT_E5_EMBEDDING_DIMENSION,
    },
  };
}

async function cleanup(seeded: {
  packId: string;
  genId: string;
  userId: string;
  profileId: string;
  bundleId: string;
  ndId: string;
  versionId: string;
}) {
  await prisma.$executeRaw`
    DELETE FROM "SearchIndexVector" WHERE "searchIndexGenerationId" = ${seeded.genId}
  `.catch(() => undefined);
  await prisma.knowledgeChunkEmbedding
    .deleteMany({ where: { searchIndexGenerationId: seeded.genId } })
    .catch(() => undefined);
  await prisma.knowledgeChunk
    .deleteMany({ where: { versionId: seeded.versionId } })
    .catch(() => undefined);
  await prisma.searchIndexGeneration.deleteMany({ where: { id: seeded.genId } }).catch(() => undefined);
  await prisma.pipelineStep.deleteMany({ where: { packId: seeded.packId } }).catch(() => undefined);
  await prisma.pipelineRun.deleteMany({ where: { packId: seeded.packId } }).catch(() => undefined);
  await prisma.normalizedDocument.deleteMany({ where: { id: seeded.ndId } }).catch(() => undefined);
  await prisma.doclingImportBundle.deleteMany({ where: { id: seeded.bundleId } }).catch(() => undefined);
  await prisma.knowledgePackVersion.deleteMany({ where: { packId: seeded.packId } }).catch(() => undefined);
  await prisma.knowledgePack.deleteMany({ where: { packId: seeded.packId } }).catch(() => undefined);
  await prisma.providerProfile.deleteMany({ where: { id: seeded.profileId } }).catch(() => undefined);
  await prisma.user.deleteMany({ where: { id: seeded.userId } }).catch(() => undefined);
}

describe("search-data real enqueue service (isolated test DB)", { skip: !runDb }, () => {
  it("startSearchDataGeneration enqueues scaffold attempt 0→1", async () => {
    const suffix = randomUUID().slice(0, 8);
    const seeded = await seedStructureScaffold(suffix);
    try {
      const before = await prisma.searchIndexGeneration.findUniqueOrThrow({
        where: { id: seeded.genId },
      });
      assert.equal(before.attempt, 0);
      assert.equal(before.status, "PENDING");

      const result = await startSearchDataGeneration({
        userId: seeded.userId,
        clientId: seeded.clientId,
        packId: seeded.packId,
        forceRegenerate: false,
      });
      assert.ok(!("error" in result), JSON.stringify(result));
      assert.equal("accepted" in result && result.accepted, true);

      const after = await prisma.searchIndexGeneration.findUniqueOrThrow({
        where: { id: seeded.genId },
      });
      assert.equal(after.id, seeded.genId);
      assert.equal(after.status, "PENDING");
      assert.equal(after.attempt, 1);
      assert.equal(after.chunkCount, 2);
      assert.equal(after.embeddedCount, 0);
      assert.equal(after.failedCount, 0);
      assert.equal(after.embeddingProvider, before.embeddingProvider);
      assert.equal(after.embeddingModel, before.embeddingModel);
      assert.equal(after.embeddingModelRevision, before.embeddingModelRevision);
      assert.equal(after.embeddingDimension, before.embeddingDimension);

      const claimed = await claimNextSearchDataGeneration();
      assert.ok(claimed);
      assert.equal(claimed.id, seeded.genId);
      assert.equal(claimed.attempt, 1);
      const row = await prisma.searchIndexGeneration.findUniqueOrThrow({
        where: { id: seeded.genId },
      });
      assert.equal(row.status, "EMBEDDING");
    } finally {
      await cleanup(seeded);
    }
  });

  it("concurrent startSearchDataGeneration keeps attempt=1", async () => {
    const suffix = randomUUID().slice(0, 8);
    const seeded = await seedStructureScaffold(suffix);
    try {
      const input = {
        userId: seeded.userId,
        clientId: seeded.clientId,
        packId: seeded.packId,
        forceRegenerate: false,
      };
      const [a, b] = await Promise.all([
        startSearchDataGeneration(input),
        startSearchDataGeneration(input),
      ]);
      assert.ok(!("error" in a) || !("error" in b));
      const after = await prisma.searchIndexGeneration.findUniqueOrThrow({
        where: { id: seeded.genId },
      });
      assert.equal(after.attempt, 1);
      assert.equal(after.status, "PENDING");
      const count = await prisma.searchIndexGeneration.count({ where: { id: seeded.genId } });
      assert.equal(count, 1);
      // At least one accepted; the other may be already_running accepted.
      const accepted = [a, b].filter((r) => "accepted" in r && r.accepted);
      assert.ok(accepted.length >= 1);
    } finally {
      await cleanup(seeded);
    }
  });

  it("concurrent claim of attempt=1 succeeds exactly once", async () => {
    const suffix = randomUUID().slice(0, 8);
    const seeded = await seedStructureScaffold(suffix);
    try {
      await prisma.searchIndexGeneration.update({
        where: { id: seeded.genId },
        data: { attempt: 1, createdAt: new Date(0) },
      });
      const [a, b] = await Promise.all([
        claimNextSearchDataGeneration(),
        claimNextSearchDataGeneration(),
      ]);
      const ours = [a, b].filter((c) => c?.id === seeded.genId);
      assert.equal(ours.length, 1);
      assert.equal(ours[0]!.attempt, 1);
      const row = await prisma.searchIndexGeneration.findUniqueOrThrow({
        where: { id: seeded.genId },
      });
      assert.equal(row.status, "EMBEDDING");
      // On isolated test DB, the other claim should be null (no other claimable gens).
      const other = [a, b].find((c) => c && c.id !== seeded.genId);
      assert.equal(other, undefined);
    } finally {
      await cleanup(seeded);
    }
  });
});
