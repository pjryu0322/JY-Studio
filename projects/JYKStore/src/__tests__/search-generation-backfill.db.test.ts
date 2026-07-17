/**
 * §38 — SearchIndexGeneration backfill integration.
 * Runs only when DATABASE_URL is set; otherwise SKIP (never fake PASS).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PackStatus } from "@prisma/client";
import { backfillSearchGenerations } from "../lib/search-generation/search-generation-backfill.ts";
import {
  createKnowledgeRunBinding,
  serializeKnowledgeRunBinding,
} from "../lib/docling-knowledge/docling-knowledge-run-binding.ts";
import { DOCLING_KNOWLEDGE_PIPELINE_TRIGGER } from "../lib/docling-knowledge/docling-knowledge-stages.ts";
import { prisma } from "../lib/prisma.ts";

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

async function seed(suffix: string, indexStatus: string, indexScope: string) {
  const packId = `bf-pack-${suffix}`;
  const category =
    (await prisma.packCategory.findFirst({ select: { categoryId: true } })) ??
    (await prisma.packCategory.create({
      data: { categoryId: `bf-cat-${suffix}`, name: "BF", description: "t" },
    }));
  const user = await prisma.user.create({
    data: { email: `bf-${suffix}@example.com`, name: "BF", accountRole: "PROVIDER" },
  });
  const profile = await prisma.providerProfile.create({
    data: { displayName: "BF", description: "t", userId: user.id, status: "ACTIVE" },
  });
  await prisma.knowledgePack.create({
    data: {
      packId,
      name: "BF Pack",
      categoryId: category.categoryId,
      providerName: "BF",
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
  const binding = createKnowledgeRunBinding({
    versionId: version.id,
    normalizedDocumentId: `bf-nd-${suffix}`,
    fingerprint: `bf-fp-${suffix}`,
    bundleId: `bf-b-${suffix}`,
    indexGenerationId: `bfgen${suffix}`.slice(0, 24),
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
  const bundle = await prisma.doclingImportBundle.create({
    data: {
      id: binding.bundleId,
      packId,
      versionId: version.id,
      status: "REVIEW_READY",
      storageStatus: "ACTIVE",
      isActive: true,
    },
  });
  await prisma.normalizedDocument.create({
    data: {
      id: binding.normalizedDocumentId,
      bundleId: bundle.id,
      packId,
      versionId: version.id,
      adapterVersion: "test",
      fingerprint: binding.fingerprint,
      isActive: true,
    },
  });
  const meta = {
    indexGenerationId: binding.indexGenerationId,
    pipelineRunId: pipeline.id,
    normalizedDocumentId: binding.normalizedDocumentId,
    normalizedDocumentFingerprint: binding.fingerprint,
    fingerprint: binding.fingerprint,
    indexStatus,
    indexScope,
    generatedBy: "docling-knowledge-pipeline",
    draftIndex: indexScope !== "PRODUCTION",
  };
  const chunk = await prisma.knowledgeChunk.create({
    data: {
      versionId: version.id,
      chunkType: "DOCLING_RETRIEVAL_CHUNK",
      title: "T",
      content: "C",
      tags: [],
      metadata: meta,
    },
  });
  await prisma.knowledgeChunkEmbedding.create({
    data: {
      chunkId: chunk.id,
      versionId: version.id,
      provider: "local-hash",
      model: "local-hash-v1",
      dimension: 256,
      vector: [0.1, 0.2],
      contentHash: `ch-${suffix}`,
    },
  });
  const run = await prisma.serviceValidationRun.create({
    data: {
      packId,
      versionId: version.id,
      channel: "API",
      status: "PASS",
      pipelineRunId: pipeline.id,
      indexGenerationId: binding.indexGenerationId,
      normalizedDocumentId: binding.normalizedDocumentId,
      fingerprint: binding.fingerprint,
      testedByUserId: user.id,
    },
  });
  return { packId, user, profile, version, binding, chunk, run };
}

async function cleanup(packId: string, profileId: string, userId: string) {
  await prisma.serviceValidationResultItem
    .deleteMany({ where: { run: { packId } } })
    .catch(() => undefined);
  await prisma.serviceValidationRun.deleteMany({ where: { packId } }).catch(() => undefined);
  await prisma.knowledgeChunkEmbedding
    .deleteMany({ where: { version: { packId } } })
    .catch(() => undefined);
  await prisma.knowledgeChunk.deleteMany({ where: { version: { packId } } }).catch(() => undefined);
  await prisma.searchIndexGeneration.deleteMany({ where: { packId } }).catch(() => undefined);
  await prisma.normalizedDocument.deleteMany({ where: { packId } }).catch(() => undefined);
  await prisma.doclingImportBundle.deleteMany({ where: { packId } }).catch(() => undefined);
  await prisma.pipelineRun.deleteMany({ where: { packId } }).catch(() => undefined);
  await prisma.knowledgePackVersion.deleteMany({ where: { packId } }).catch(() => undefined);
  await prisma.knowledgePack.deleteMany({ where: { packId } }).catch(() => undefined);
  await prisma.providerProfile.deleteMany({ where: { id: profileId } }).catch(() => undefined);
  await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
}

describe("search generation backfill (§38)", { skip: !hasDb }, () => {
  it("creates a DRAFT->READY generation and links chunk/embedding/run, idempotently", async () => {
    const suffix = `${Date.now()}`.slice(-10);
    const s = await seed(suffix, "DRAFT", "DRAFT");
    try {
      const first = await backfillSearchGenerations({ versionId: s.version.id });
      assert.equal(first.generationsFound, 1);
      assert.equal(first.created, 1);
      assert.equal(first.reused, 0);
      assert.equal(first.chunksLinked, 1);
      assert.equal(first.embeddingsLinked, 1);
      assert.equal(first.validationRunsLinked, 1);

      const gen = await prisma.searchIndexGeneration.findUnique({
        where: { id: s.binding.indexGenerationId },
      });
      assert.ok(gen);
      assert.equal(gen.status, "READY");
      assert.equal(gen.scope, "DRAFT");

      const chunk = await prisma.knowledgeChunk.findUnique({ where: { id: s.chunk.id } });
      assert.equal(chunk?.chunkGenerationId, s.binding.indexGenerationId);
      const run = await prisma.serviceValidationRun.findUnique({ where: { id: s.run.id } });
      assert.equal(run?.searchIndexGenerationId, s.binding.indexGenerationId);

      // Idempotent second run: reuse, no duplicates, no new links.
      const second = await backfillSearchGenerations({ versionId: s.version.id });
      assert.equal(second.created, 0);
      assert.equal(second.reused, 1);
      assert.equal(second.chunksLinked, 0);
      assert.equal(second.embeddingsLinked, 0);
      assert.equal(second.validationRunsLinked, 0);
      const count = await prisma.searchIndexGeneration.count({ where: { packId: s.packId } });
      assert.equal(count, 1);
    } finally {
      await cleanup(s.packId, s.profile.id, s.user.id);
    }
  });

  it("maps APPROVED metadata to PROMOTED/PRODUCTION", async () => {
    const suffix = `${Date.now()}`.slice(-10) + "a";
    const s = await seed(suffix, "APPROVED", "PRODUCTION");
    try {
      const report = await backfillSearchGenerations({ versionId: s.version.id });
      assert.equal(report.created, 1);
      const gen = await prisma.searchIndexGeneration.findUnique({
        where: { id: s.binding.indexGenerationId },
      });
      assert.equal(gen?.status, "PROMOTED");
      assert.equal(gen?.scope, "PRODUCTION");
    } finally {
      await cleanup(s.packId, s.profile.id, s.user.id);
    }
  });

  it("skips a generation when the normalized document does not match", async () => {
    const suffix = `${Date.now()}`.slice(-10) + "b";
    const s = await seed(suffix, "DRAFT", "DRAFT");
    await prisma.normalizedDocument.updateMany({
      where: { id: s.binding.normalizedDocumentId },
      data: { versionId: s.version.id, packId: s.packId },
    });
    // Corrupt the chunk metadata to point at a non-existent ND.
    await prisma.knowledgeChunk.update({
      where: { id: s.chunk.id },
      data: {
        metadata: {
          indexGenerationId: s.binding.indexGenerationId,
          pipelineRunId: "does-not-matter",
          normalizedDocumentId: "missing-nd",
          fingerprint: s.binding.fingerprint,
          normalizedDocumentFingerprint: s.binding.fingerprint,
          indexStatus: "DRAFT",
          indexScope: "DRAFT",
        },
      },
    });
    try {
      const report = await backfillSearchGenerations({ versionId: s.version.id });
      assert.equal(report.generationsFound, 1);
      assert.equal(report.created, 0);
      assert.equal(report.skipped, 1);
      assert.ok((report.skipReasons.nd_mismatch ?? 0) >= 1);
    } finally {
      await cleanup(s.packId, s.profile.id, s.user.id);
    }
  });
});
