/**
 * P5.1.1 — Admin approval transaction atomicity (PostgreSQL).
 * Runs only when DATABASE_URL is set; otherwise SKIP (never fake PASS).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PackStatus } from "@prisma/client";
import { assertApprovalSearchGenerationInTx } from "../lib/distribution/approval-search-generation-evidence.ts";
import { buildDoclingBundleReviewSubmitSnapshot } from "../lib/distribution/distribution-submit-snapshot.ts";
import { PayloadServiceError } from "../lib/distribution/payload-errors.ts";
import {
  createKnowledgeRunBinding,
  serializeKnowledgeRunBinding,
} from "../lib/docling-knowledge/docling-knowledge-run-binding.ts";
import { DOCLING_KNOWLEDGE_PIPELINE_TRIGGER } from "../lib/docling-knowledge/docling-knowledge-stages.ts";
import { PackReviewStatus } from "../lib/pack-review-status.ts";
import { promoteSearchGeneration } from "../lib/search-generation/search-generation-service.ts";
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

const SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_OTHER = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const testedAt = new Date("2026-07-18T00:00:00.000Z");

async function seedApprovalReadyPack(suffix: string) {
  const packId = `appr-pack-${suffix}`;
  const generationId = `appr-gen-${suffix}`;
  const category =
    (await prisma.packCategory.findFirst({ select: { categoryId: true } })) ??
    (await prisma.packCategory.create({
      data: { categoryId: `appr-cat-${suffix}`, name: "Appr Cat", description: "t" },
    }));
  const user = await prisma.user.create({
    data: { email: `appr-${suffix}@example.com`, name: "Appr", accountRole: "PROVIDER" },
  });
  const profile = await prisma.providerProfile.create({
    data: { displayName: "Appr", description: "t", userId: user.id, status: "ACTIVE" },
  });
  await prisma.knowledgePack.create({
    data: {
      packId,
      name: "Appr Pack",
      categoryId: category.categoryId,
      providerName: "Appr",
      providerType: "COMMUNITY",
      status: PackStatus.REVIEWING,
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
    normalizedDocumentId: `appr-nd-${suffix}`,
    fingerprint: `appr-fp-${suffix}`,
    bundleId: `appr-b-${suffix}`,
    indexGenerationId: generationId,
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
  await prisma.pipelineStepLog.createMany({
    data: [
      { runId: pipeline.id, packId, step: "STRUCTURE_VALIDATING", status: "PASS" },
      { runId: pipeline.id, packId, step: "SEARCH_EVALUATING", status: "PASS" },
      { runId: pipeline.id, packId, step: "READY_FOR_REVIEW", status: "PASS" },
    ],
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
  const sourceFile = await prisma.knowledgePackFile.create({
    data: {
      packId,
      versionId: version.id,
      role: "SOURCE_ORIGINAL",
      originalFileName: "doc.pdf",
      mimeType: "application/pdf",
      fileExtension: "pdf",
      fileSize: BigInt(10),
      checksumSha256: "a".repeat(64),
      storageKey: `test/${suffix}/doc.pdf`,
      bundleId: bundle.id,
    },
  });
  const jsonFile = await prisma.knowledgePackFile.create({
    data: {
      packId,
      versionId: version.id,
      role: "DOCLING_JSON",
      originalFileName: "doc.json",
      mimeType: "application/json",
      fileExtension: "json",
      fileSize: BigInt(10),
      checksumSha256: "b".repeat(64),
      storageKey: `test/${suffix}/doc.json`,
      bundleId: bundle.id,
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
      sourceFileId: sourceFile.id,
      jsonPayloadFileId: jsonFile.id,
    },
  });
  await prisma.packDistributionMetadata.create({
    data: {
      packId,
      versionId: version.id,
      sourceTitle: "Source",
      licenseName: "MIT",
      visibility: "PUBLIC",
      allowApi: true,
      allowMcp: true,
      allowDownload: false,
      rightsBasis: "RIGHTS_HOLDER",
      rightsConfirmedAt: new Date(),
    },
  });

  const generation = await prisma.searchIndexGeneration.create({
    data: {
      id: generationId,
      packId,
      versionId: version.id,
      pipelineRunId: pipeline.id,
      normalizedDocumentId: binding.normalizedDocumentId,
      chunkGenerationId: generationId,
      fingerprint: binding.fingerprint!,
      embeddingProvider: "local-e5",
      embeddingModel: "dragonkue/multilingual-e5-small-ko-v2",
      embeddingModelRevision: SHA,
      embeddingDimension: 384,
      distanceMetric: "cosine",
      chunkCount: 2,
      embeddedCount: 2,
      failedCount: 0,
      status: "READY",
      scope: "DRAFT",
      generationFingerprint: `sgf-${suffix}`,
    },
  });

  const runIds: Record<string, string> = {};
  const confIds: Record<string, string> = {};
  let downloadTestId = "";
  for (const channel of ["API", "MCP", "DOWNLOAD"] as const) {
    const run = await prisma.serviceValidationRun.create({
      data: {
        packId,
        versionId: version.id,
        channel,
        status: "PASS",
        pipelineRunId: pipeline.id,
        indexGenerationId: generation.id,
        searchIndexGenerationId: generation.id,
        normalizedDocumentId: binding.normalizedDocumentId,
        fingerprint: binding.fingerprint,
        resultFingerprint: channel === "DOWNLOAD" ? null : `rf-${channel}-${suffix}`,
        testedAt,
        testedByUserId: user.id,
      },
    });
    runIds[channel] = run.id;
    if (channel === "API" || channel === "MCP") {
      await prisma.serviceValidationResultItem.create({
        data: {
          runId: run.id,
          rank: 1,
          chunkId: `chunk-${channel}-${suffix}`,
          title: "R",
          snippet: "S",
          score: 1,
          sourceDocumentId: `srcdoc-${suffix}`,
          sourceFileId: sourceFile.id,
        },
      });
    } else {
      const dt = await prisma.serviceValidationDownloadTest.create({
        data: {
          runId: run.id,
          fileId: sourceFile.id,
          testedByUserId: user.id,
          responseReady: true,
        },
      });
      downloadTestId = dt.id;
    }
    const conf = await prisma.serviceValidationProviderConfirmation.create({
      data: {
        runId: run.id,
        status: "CONFIRMED",
        relevanceConfirmed: true,
        contentConfirmed: true,
        sourceConfirmed: true,
        isolationConfirmed: true,
        fileNameConfirmed: true,
        downloadOkConfirmed: true,
        fileMatchConfirmed: true,
        confirmedByUserId: user.id,
      },
    });
    confIds[channel] = conf.id;
  }

  const entry = (channel: "API" | "MCP" | "DOWNLOAD") => ({
    status: "PASS" as const,
    runId: runIds[channel]!,
    testedAt: testedAt.toISOString(),
    currentValidity: "CURRENT" as const,
    providerConfirmationStatus: "CONFIRMED" as const,
    providerConfirmationId: confIds[channel]!,
    confirmedAt: testedAt.toISOString(),
    pipelineRunId: pipeline.id,
    normalizedDocumentId: binding.normalizedDocumentId,
    indexGenerationId: generation.id,
    fingerprint: binding.fingerprint,
    ...(channel === "DOWNLOAD"
      ? { downloadTestId }
      : { resultFingerprint: `rf-${channel}-${suffix}` }),
  });

  const review = await prisma.packReview.create({
    data: {
      packId,
      status: PackReviewStatus.IN_REVIEW,
      submitSnapshot: {},
    },
  });

  const snapshot = buildDoclingBundleReviewSubmitSnapshot({
    submittedVersionId: version.id,
    doclingBundleId: bundle.id,
    sourceFileId: sourceFile.id,
    jsonPayloadFileId: jsonFile.id,
    markdownPayloadFileId: null,
    checksums: { source: "a".repeat(64), json: "b".repeat(64), markdown: null },
    doclingSchemaVersion: "1.1",
    adapterVersion: "test",
    normalizedDocumentId: binding.normalizedDocumentId,
    fingerprint: binding.fingerprint!,
    warningCount: 0,
    sourceTitle: "Source",
    licenseName: "MIT",
    visibility: "PUBLIC",
    allowDownload: false,
    allowApi: true,
    allowMcp: true,
    preparationValidation: {
      API: entry("API"),
      MCP: entry("MCP"),
      DOWNLOAD: entry("DOWNLOAD"),
    },
    distributionChannels: { allowApi: true, allowMcp: true, allowDownload: false },
    language: "ko",
    pipelineRunId: pipeline.id,
    indexGenerationId: generation.id,
    searchIndexGenerationId: generation.id,
    searchGenerationFingerprint: generation.generationFingerprint,
    chunkGenerationId: generation.chunkGenerationId,
    embeddingProvider: generation.embeddingProvider,
    embeddingModel: generation.embeddingModel,
    embeddingModelRevision: generation.embeddingModelRevision,
    embeddingDimension: generation.embeddingDimension,
    distanceMetric: generation.distanceMetric,
    retrievalEvaluationStatus: "PASS",
    normalizedDocumentFingerprint: binding.fingerprint!,
  });

  return { packId, generation, review, snapshot, userId: user.id };
}

async function cleanup(packId: string) {
  const runs = await prisma.serviceValidationRun.findMany({
    where: { packId },
    select: { id: true },
  });
  const runIds = runs.map((r) => r.id);
  if (runIds.length) {
    await prisma.serviceValidationProviderConfirmation.deleteMany({
      where: { runId: { in: runIds } },
    });
    await prisma.serviceValidationResultItem.deleteMany({ where: { runId: { in: runIds } } });
    await prisma.serviceValidationDownloadTest.deleteMany({ where: { runId: { in: runIds } } });
  }
  await prisma.serviceValidationRun.deleteMany({ where: { packId } });
  await prisma.packReview.deleteMany({ where: { packId } });
  await prisma.searchIndexGeneration.deleteMany({ where: { packId } });
  await prisma.pipelineStepLog.deleteMany({ where: { packId } });
  await prisma.pipelineRun.deleteMany({ where: { packId } });
  await prisma.normalizedDocument.deleteMany({ where: { packId } });
  await prisma.knowledgePackFile.deleteMany({ where: { packId } });
  await prisma.doclingImportBundle.deleteMany({ where: { packId } });
  await prisma.packDistributionMetadata.deleteMany({ where: { packId } });
  await prisma.knowledgePackVersion.deleteMany({ where: { packId } });
  await prisma.knowledgePack.deleteMany({ where: { packId } });
}

describe("approval transaction atomicity (P5.1.1)", { skip: !hasDb }, () => {
  it("assertApprovalSearchGenerationInTx succeeds when all evidence matches", async () => {
    const suffix = `${Date.now()}-ok`;
    const seeded = await seedApprovalReadyPack(suffix);
    try {
      await prisma.$transaction(async (tx) => {
        const evidence = await assertApprovalSearchGenerationInTx(tx, {
          packId: seeded.packId,
          reviewId: seeded.review.id,
          snapshot: seeded.snapshot,
        });
        assert.equal(evidence.generation.id, seeded.generation.id);
        assert.equal(evidence.generation.embeddingModelRevision, SHA);
      });
    } finally {
      await cleanup(seeded.packId);
    }
  });

  it("descriptor revision drift fails inside the transaction", async () => {
    const suffix = `${Date.now()}-drift`;
    const seeded = await seedApprovalReadyPack(suffix);
    try {
      const drifted = { ...seeded.snapshot, embeddingModelRevision: SHA_OTHER };
      await assert.rejects(
        () =>
          prisma.$transaction(async (tx) => {
            await assertApprovalSearchGenerationInTx(tx, {
              packId: seeded.packId,
              reviewId: seeded.review.id,
              snapshot: drifted,
            });
          }),
        (error: unknown) => error instanceof PayloadServiceError,
      );
      const still = await prisma.searchIndexGeneration.findUnique({
        where: { id: seeded.generation.id },
      });
      assert.equal(still?.status, "READY");
      assert.equal(still?.scope, "DRAFT");
    } finally {
      await cleanup(seeded.packId);
    }
  });

  it("conditional promote with wrong revision yields TRANSITION_CONFLICT and leaves DRAFT", async () => {
    const suffix = `${Date.now()}-guard`;
    const seeded = await seedApprovalReadyPack(suffix);
    try {
      await assert.rejects(
        () =>
          prisma.$transaction(async (tx) => {
            await promoteSearchGeneration(seeded.generation.id, tx, {
              generationFingerprint: seeded.generation.generationFingerprint,
              embeddingProvider: seeded.generation.embeddingProvider,
              embeddingModel: seeded.generation.embeddingModel,
              embeddingModelRevision: SHA_OTHER,
              embeddingDimension: seeded.generation.embeddingDimension,
              distanceMetric: seeded.generation.distanceMetric,
            });
          }),
        (error: unknown) =>
          error instanceof PayloadServiceError &&
          error.code === "SEARCH_GENERATION_TRANSITION_CONFLICT",
      );
      const still = await prisma.searchIndexGeneration.findUnique({
        where: { id: seeded.generation.id },
      });
      assert.equal(still?.status, "READY");
      assert.equal(still?.scope, "DRAFT");
    } finally {
      await cleanup(seeded.packId);
    }
  });

  it("matching guard promotes READY/DRAFT → PROMOTED/PRODUCTION", async () => {
    const suffix = `${Date.now()}-promo`;
    const seeded = await seedApprovalReadyPack(suffix);
    try {
      await prisma.$transaction(async (tx) => {
        await promoteSearchGeneration(seeded.generation.id, tx, {
          generationFingerprint: seeded.generation.generationFingerprint,
          embeddingProvider: seeded.generation.embeddingProvider,
          embeddingModel: seeded.generation.embeddingModel,
          embeddingModelRevision: seeded.generation.embeddingModelRevision,
          embeddingDimension: seeded.generation.embeddingDimension,
          distanceMetric: seeded.generation.distanceMetric,
        });
      });
      const promoted = await prisma.searchIndexGeneration.findUnique({
        where: { id: seeded.generation.id },
      });
      assert.equal(promoted?.status, "PROMOTED");
      assert.equal(promoted?.scope, "PRODUCTION");
      assert.equal(promoted?.embeddingModelRevision, SHA);
    } finally {
      await cleanup(seeded.packId);
    }
  });
});

describe("approval transaction atomicity (skipped without DATABASE_URL)", {
  skip: hasDb,
}, () => {
  it("reports skip — PostgreSQL not configured", () => {
    assert.equal(hasDb, false);
  });
});
