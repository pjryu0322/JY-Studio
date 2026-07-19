/**
 * P5.1.3 — Admin approval transaction atomicity (PostgreSQL).
 * Runs only when DATABASE_URL is set; otherwise SKIP (never fake PASS).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PackStatus, Prisma, AuditAction } from "@prisma/client";
import { approvePackReview, rejectPackReview } from "../lib/admin-review-service.ts";
import { assertApprovalSearchGenerationInTx } from "../lib/distribution/approval-search-generation-evidence.ts";
import { buildDoclingBundleReviewSubmitSnapshot } from "../lib/distribution/distribution-submit-snapshot.ts";
import { PayloadServiceError } from "../lib/distribution/payload-errors.ts";
import { computeReviewSubmitSnapshotFingerprint } from "../lib/distribution/review-submit-snapshot-fingerprint.ts";
import { assertCurrentServiceValidationEvidence } from "../lib/distribution/service-validation-service.ts";
import {
  createKnowledgeRunBinding,
  serializeKnowledgeRunBinding,
} from "../lib/docling-knowledge/docling-knowledge-run-binding.ts";
import {
  DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
  DOCLING_RETRIEVAL_CHUNK_TYPE,
} from "../lib/docling-knowledge/docling-knowledge-stages.ts";
import {
  computeNormalizedDocumentFingerprint,
  NORMALIZED_DOCUMENT_FINGERPRINT_VERSION,
} from "../lib/docling-import/normalized-document-fingerprint.ts";
import { PackReviewStatus } from "../lib/pack-review-status.ts";
import { InMemoryObjectStorage } from "../lib/object-storage/in-memory-object-storage.ts";
import { setObjectStorageForTests } from "../lib/object-storage/object-storage-factory.ts";
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

async function seedApprovalReadyPack(
  suffix: string,
  options: { fullIntegrity?: boolean } = {},
) {
  const packId = `appr-pack-${suffix}`;
  const generationId = `appr-gen-${suffix}`;
  const sourceChecksum = "a".repeat(64);
  const jsonChecksum = "b".repeat(64);
  const category =
    (await prisma.packCategory.findFirst({ select: { categoryId: true } })) ??
    (await prisma.packCategory.create({
      data: {
        categoryId: `appr-cat-${suffix}`,
        name: "Appr Cat",
        description: "t",
        icon: "book",
      },
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
  const bundle = await prisma.doclingImportBundle.create({
    data: {
      id: `appr-b-${suffix}`,
      packId,
      versionId: version.id,
      status: "REVIEW_READY",
      storageStatus: "ACTIVE",
      isActive: true,
    },
  });
  const sourceBytes = new TextEncoder().encode("PDF-BYTES!!");
  const jsonBytes = new TextEncoder().encode('{"schema_name":"DoclingDocument"}');
  const sourceFile = await prisma.knowledgePackFile.create({
    data: {
      packId,
      versionId: version.id,
      role: "SOURCE_ORIGINAL",
      originalFileName: "doc.pdf",
      mimeType: "application/pdf",
      fileExtension: "pdf",
      fileSize: BigInt(sourceBytes.byteLength),
      checksumSha256: sourceChecksum,
      storageKey: `test/${suffix}/doc.pdf`,
      bundleId: bundle.id,
      isImmutable: true,
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
      fileSize: BigInt(jsonBytes.byteLength),
      checksumSha256: jsonChecksum,
      storageKey: `test/${suffix}/doc.json`,
      bundleId: bundle.id,
      isImmutable: true,
    },
  });

  const ndId = `appr-nd-${suffix}`;
  const fingerprint = options.fullIntegrity
    ? computeNormalizedDocumentFingerprint({
        adapterType: "DOCLING",
        adapterVersion: "test",
        sourceSchemaName: null,
        sourceSchemaVersion: null,
        title: null,
        language: null,
        sections: [],
        tables: [],
        figures: [],
        readingOrder: [],
        warnings: [],
        sourceFileId: sourceFile.id,
        jsonPayloadFileId: jsonFile.id,
        markdownPayloadFileId: null,
        sourceChecksum,
        jsonChecksum,
        markdownChecksum: null,
      })
    : `appr-fp-${suffix}`;

  const binding = createKnowledgeRunBinding({
    versionId: version.id,
    normalizedDocumentId: ndId,
    fingerprint,
    bundleId: bundle.id,
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
      {
        runId: pipeline.id,
        packId,
        step: "SEARCH_EVALUATING",
        status: "PASS",
        details: { retrievalRankingPolicyVersion: "relevance_diversity_v2" },
      },
      { runId: pipeline.id, packId, step: "READY_FOR_REVIEW", status: "PASS" },
    ],
  });
  await prisma.normalizedDocument.create({
    data: {
      id: ndId,
      bundleId: bundle.id,
      packId,
      versionId: version.id,
      adapterType: "DOCLING",
      adapterVersion: "test",
      fingerprint,
      fingerprintVersion: NORMALIZED_DOCUMENT_FINGERPRINT_VERSION,
      isActive: true,
      sourceFileId: sourceFile.id,
      jsonPayloadFileId: jsonFile.id,
      sourcePayloadChecksum: sourceChecksum,
      sectionsJson: [],
      tablesJson: [],
      figuresJson: [],
      readingOrderJson: [],
      warningsJson: [],
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
      normalizedDocumentId: ndId,
      chunkGenerationId: generationId,
      fingerprint,
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

  if (options.fullIntegrity) {
    await prisma.knowledgeChunk.create({
      data: {
        versionId: version.id,
        chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
        title: "chunk",
        content: "content",
        tags: [],
        sortOrder: 0,
        isActive: true,
        chunkGenerationId: generationId,
        metadata: {
          indexGenerationId: generationId,
          pipelineRunId: pipeline.id,
          fingerprint,
          indexScope: "DRAFT",
          indexStatus: "DRAFT",
          draftIndex: true,
        },
      },
    });
  }

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
        normalizedDocumentId: ndId,
        fingerprint,
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
        confirmedAt: testedAt,
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
    normalizedDocumentId: ndId,
    indexGenerationId: generation.id,
    searchIndexGenerationId: generation.id,
    fingerprint,
    ...(channel === "DOWNLOAD"
      ? { downloadTestId }
      : { resultFingerprint: `rf-${channel}-${suffix}` }),
  });

  const snapshot = buildDoclingBundleReviewSubmitSnapshot({
    submittedVersionId: version.id,
    doclingBundleId: bundle.id,
    sourceFileId: sourceFile.id,
    jsonPayloadFileId: jsonFile.id,
    markdownPayloadFileId: null,
    checksums: { source: sourceChecksum, json: jsonChecksum, markdown: null },
    doclingSchemaVersion: "1.1",
    adapterVersion: "test",
    normalizedDocumentId: ndId,
    fingerprint,
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
    normalizedDocumentFingerprint: fingerprint,
  });

  const review = await prisma.packReview.create({
    data: {
      packId,
      status: PackReviewStatus.IN_REVIEW,
      submitSnapshot: snapshot as unknown as Prisma.InputJsonValue,
    },
  });

  let storage: InMemoryObjectStorage | null = null;
  if (options.fullIntegrity) {
    storage = new InMemoryObjectStorage();
    await storage.putSmallObject({
      objectKey: sourceFile.storageKey,
      bytes: sourceBytes,
      checksumSha256: sourceChecksum,
      packId,
      versionId: version.id,
      payloadId: sourceFile.id,
    });
    await storage.putSmallObject({
      objectKey: jsonFile.storageKey,
      bytes: jsonBytes,
      checksumSha256: jsonChecksum,
      packId,
      versionId: version.id,
      payloadId: jsonFile.id,
    });
  }

  return {
    packId,
    generation,
    review,
    snapshot,
    snapshotFingerprint: computeReviewSubmitSnapshotFingerprint(snapshot),
    userId: user.id,
    versionId: version.id,
    runIds,
    downloadTestId,
    storage,
    sourceFileId: sourceFile.id,
    jsonFileId: jsonFile.id,
  };
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
  await prisma.knowledgeChunk.deleteMany({
    where: { version: { packId } },
  });
  await prisma.searchIndexGeneration.deleteMany({ where: { packId } });
  await prisma.pipelineStepLog.deleteMany({ where: { packId } });
  await prisma.pipelineRun.deleteMany({ where: { packId } });
  await prisma.normalizedDocument.deleteMany({ where: { packId } });
  await prisma.knowledgePackFile.deleteMany({ where: { packId } });
  await prisma.doclingImportBundle.deleteMany({ where: { packId } });
  await prisma.packDistributionMetadata.deleteMany({ where: { packId } });
  await prisma.knowledgePackVersion.deleteMany({ where: { packId } });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [{ entityId: packId }, { entityType: "DoclingImportBundle" }],
    },
  });
  await prisma.knowledgePack.deleteMany({ where: { packId } });
}

describe("approval transaction atomicity (P5.1.3)", { skip: !hasDb }, () => {
  it("assertApprovalSearchGenerationInTx succeeds from DB submitSnapshot (no external snapshot)", async () => {
    const suffix = `${Date.now()}-ok`;
    const seeded = await seedApprovalReadyPack(suffix);
    try {
      await prisma.$transaction(async (tx) => {
        const evidence = await assertApprovalSearchGenerationInTx(tx, {
          packId: seeded.packId,
          reviewId: seeded.review.id,
          expectedSnapshotFingerprint: seeded.snapshotFingerprint,
        });
        assert.equal(evidence.generation.id, seeded.generation.id);
        assert.equal(evidence.snapshot.searchIndexGenerationId, seeded.generation.id);
        assert.equal(evidence.snapshot.chunkGenerationId, seeded.generation.chunkGenerationId);
        assert.equal(evidence.generation.embeddingModelRevision, SHA);
      });
    } finally {
      await cleanup(seeded.packId);
    }
  });

  it("empty DB submitSnapshot fails even when an external snapshot would be valid", async () => {
    const suffix = `${Date.now()}-empty`;
    const seeded = await seedApprovalReadyPack(suffix);
    try {
      await prisma.packReview.update({
        where: { id: seeded.review.id },
        data: { submitSnapshot: {} },
      });
      await assert.rejects(
        () =>
          prisma.$transaction(async (tx) => {
            await assertApprovalSearchGenerationInTx(tx, {
          packId: seeded.packId,
          reviewId: seeded.review.id,
          expectedSnapshotFingerprint: seeded.snapshotFingerprint,
        });
          }),
        (error: unknown) =>
          error instanceof PayloadServiceError &&
          (error.code === "APPROVAL_SNAPSHOT_MISMATCH" ||
            error.code === "SEARCH_GENERATION_MISMATCH"),
      );
    } finally {
      await cleanup(seeded.packId);
    }
  });

  it("DB snapshot revision drift fails (external memory snapshot is ignored)", async () => {
    const suffix = `${Date.now()}-drift`;
    const seeded = await seedApprovalReadyPack(suffix);
    try {
      const drifted = {
        ...seeded.snapshot,
        embeddingModelRevision: SHA_OTHER,
      };
      await prisma.packReview.update({
        where: { id: seeded.review.id },
        data: { submitSnapshot: drifted as unknown as Prisma.InputJsonValue },
      });
      await assert.rejects(
        () =>
          prisma.$transaction(async (tx) => {
            await assertApprovalSearchGenerationInTx(tx, {
          packId: seeded.packId,
          reviewId: seeded.review.id,
          expectedSnapshotFingerprint: seeded.snapshotFingerprint,
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

  it("chunkGenerationId mismatch with indexGenerationId fails", async () => {
    const suffix = `${Date.now()}-chunk`;
    const seeded = await seedApprovalReadyPack(suffix);
    try {
      const bad = {
        ...seeded.snapshot,
        chunkGenerationId: `other-chunk-${suffix}`,
      };
      await prisma.packReview.update({
        where: { id: seeded.review.id },
        data: { submitSnapshot: bad as unknown as Prisma.InputJsonValue },
      });
      await assert.rejects(
        () =>
          prisma.$transaction(async (tx) => {
            await assertApprovalSearchGenerationInTx(tx, {
              packId: seeded.packId,
              reviewId: seeded.review.id,
              expectedSnapshotFingerprint: computeReviewSubmitSnapshotFingerprint(bad),
            });
          }),
        (error: unknown) =>
          error instanceof PayloadServiceError && error.code === "SEARCH_GENERATION_MISMATCH",
      );
    } finally {
      await cleanup(seeded.packId);
    }
  });

  it("service validation evidence re-check in tx blocks when run is invalidated", async () => {
    const suffix = `${Date.now()}-svc`;
    const seeded = await seedApprovalReadyPack(suffix);
    try {
      await prisma.serviceValidationRun.update({
        where: { id: seeded.runIds.API },
        data: { invalidatedAt: new Date() },
      });
      await assert.rejects(
        () =>
          prisma.$transaction(async (tx) => {
            const evidence = await assertApprovalSearchGenerationInTx(tx, {
          packId: seeded.packId,
          reviewId: seeded.review.id,
          expectedSnapshotFingerprint: seeded.snapshotFingerprint,
        });
            await assertCurrentServiceValidationEvidence({
              client: tx,
              packId: seeded.packId,
              versionId: evidence.versionId,
              snapshot: evidence.snapshot,
            });
          }),
        (error: unknown) =>
          error instanceof PayloadServiceError &&
          error.code === "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
      );
      const pack = await prisma.knowledgePack.findUnique({ where: { packId: seeded.packId } });
      const review = await prisma.packReview.findUnique({ where: { id: seeded.review.id } });
      const gen = await prisma.searchIndexGeneration.findUnique({
        where: { id: seeded.generation.id },
      });
      assert.equal(pack?.status, PackStatus.REVIEWING);
      assert.equal(review?.status, PackReviewStatus.IN_REVIEW);
      assert.equal(gen?.status, "READY");
      assert.equal(gen?.scope, "DRAFT");
    } finally {
      await cleanup(seeded.packId);
    }
  });

  it("DOWNLOAD responseReady=false blocks service validation in tx", async () => {
    const suffix = `${Date.now()}-dl`;
    const seeded = await seedApprovalReadyPack(suffix);
    try {
      await prisma.serviceValidationDownloadTest.update({
        where: { id: seeded.downloadTestId },
        data: { responseReady: false },
      });
      await assert.rejects(
        () =>
          prisma.$transaction(async (tx) => {
            const evidence = await assertApprovalSearchGenerationInTx(tx, {
          packId: seeded.packId,
          reviewId: seeded.review.id,
          expectedSnapshotFingerprint: seeded.snapshotFingerprint,
        });
            await assertCurrentServiceValidationEvidence({
              client: tx,
              packId: seeded.packId,
              versionId: evidence.versionId,
              snapshot: evidence.snapshot,
            });
          }),
        (error: unknown) =>
          error instanceof PayloadServiceError &&
          error.code === "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
      );
    } finally {
      await cleanup(seeded.packId);
    }
  });

  it("Pack DRAFT pre-change causes APPROVAL_TRANSITION_CONFLICT and rolls back promote", async () => {
    const suffix = `${Date.now()}-pack`;
    const seeded = await seedApprovalReadyPack(suffix);
    try {
      await assert.rejects(
        () =>
          prisma.$transaction(async (tx) => {
            await assertApprovalSearchGenerationInTx(tx, {
          packId: seeded.packId,
          reviewId: seeded.review.id,
          expectedSnapshotFingerprint: seeded.snapshotFingerprint,
        });
            await promoteSearchGeneration(seeded.generation.id, tx, {
              generationFingerprint: seeded.generation.generationFingerprint,
              embeddingProvider: seeded.generation.embeddingProvider,
              embeddingModel: seeded.generation.embeddingModel,
              embeddingModelRevision: seeded.generation.embeddingModelRevision,
              embeddingDimension: seeded.generation.embeddingDimension,
              distanceMetric: seeded.generation.distanceMetric,
            });
            // Simulate concurrent reject: pack left REVIEWING in this tx's snapshot
            // but we force conflict by requiring REVIEWING after flipping outside ??instead
            // mutate via nested raw path: updateMany with impossible status.
            await tx.knowledgePack.update({
              where: { packId: seeded.packId },
              data: { status: PackStatus.DRAFT },
            });
            const packTransition = await tx.knowledgePack.updateMany({
              where: { packId: seeded.packId, status: PackStatus.REVIEWING },
              data: { status: PackStatus.PUBLISHED, publishedAt: new Date() },
            });
            if (packTransition.count !== 1) {
              throw new PayloadServiceError(
                "APPROVAL_TRANSITION_CONFLICT",
                "寃???곹깭媛 蹂寃쎈릺???뱀씤?????놁뒿?덈떎.",
                409,
              );
            }
          }),
        (error: unknown) =>
          error instanceof PayloadServiceError && error.code === "APPROVAL_TRANSITION_CONFLICT",
      );
      const pack = await prisma.knowledgePack.findUnique({ where: { packId: seeded.packId } });
      const gen = await prisma.searchIndexGeneration.findUnique({
        where: { id: seeded.generation.id },
      });
      assert.equal(pack?.status, PackStatus.REVIEWING);
      assert.equal(gen?.status, "READY");
      assert.equal(gen?.scope, "DRAFT");
    } finally {
      await cleanup(seeded.packId);
    }
  });

  it("Review REJECTED pre-change causes APPROVAL_TRANSITION_CONFLICT", async () => {
    const suffix = `${Date.now()}-rev`;
    const seeded = await seedApprovalReadyPack(suffix);
    try {
      await prisma.packReview.update({
        where: { id: seeded.review.id },
        data: { status: PackReviewStatus.REJECTED },
      });
      await assert.rejects(
        () =>
          prisma.$transaction(async (tx) => {
            await assertApprovalSearchGenerationInTx(tx, {
          packId: seeded.packId,
          reviewId: seeded.review.id,
          expectedSnapshotFingerprint: seeded.snapshotFingerprint,
        });
          }),
        (error: unknown) =>
          error instanceof PayloadServiceError &&
          (error.code === "APPROVAL_TRANSITION_CONFLICT" ||
            error.code === "SEARCH_GENERATION_MISMATCH"),
      );
    } finally {
      await cleanup(seeded.packId);
    }
  });

  it("approve vs reject conditional updateMany: exactly one wins", async () => {
    const suffix = `${Date.now()}-race`;
    const seeded = await seedApprovalReadyPack(suffix);
    try {
      const now = new Date();
      const results = await Promise.allSettled([
        prisma.$transaction(async (tx) => {
          const packTransition = await tx.knowledgePack.updateMany({
            where: { packId: seeded.packId, status: PackStatus.REVIEWING },
            data: { status: PackStatus.PUBLISHED, publishedAt: now, isVerified: false },
          });
          if (packTransition.count !== 1) {
            throw new PayloadServiceError("APPROVAL_TRANSITION_CONFLICT", "approve pack", 409);
          }
          const reviewTransition = await tx.packReview.updateMany({
            where: {
              id: seeded.review.id,
              packId: seeded.packId,
              status: PackReviewStatus.IN_REVIEW,
            },
            data: {
              status: PackReviewStatus.APPROVED,
              decision: "APPROVE",
              decidedAt: now,
            },
          });
          if (reviewTransition.count !== 1) {
            throw new PayloadServiceError("APPROVAL_TRANSITION_CONFLICT", "approve review", 409);
          }
          return "approve" as const;
        }),
        prisma.$transaction(async (tx) => {
          const packTransition = await tx.knowledgePack.updateMany({
            where: { packId: seeded.packId, status: PackStatus.REVIEWING },
            data: { status: PackStatus.DRAFT },
          });
          if (packTransition.count !== 1) {
            throw new PayloadServiceError("REVIEW_TRANSITION_CONFLICT", "reject pack", 409);
          }
          const reviewTransition = await tx.packReview.updateMany({
            where: {
              id: seeded.review.id,
              packId: seeded.packId,
              status: PackReviewStatus.IN_REVIEW,
            },
            data: {
              status: PackReviewStatus.REJECTED,
              decision: "REJECT",
              rejectionReason: "race",
              decidedAt: now,
            },
          });
          if (reviewTransition.count !== 1) {
            throw new PayloadServiceError("REVIEW_TRANSITION_CONFLICT", "reject review", 409);
          }
          return "reject" as const;
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      assert.equal(fulfilled.length, 1);
      assert.equal(rejected.length, 1);

      const pack = await prisma.knowledgePack.findUnique({ where: { packId: seeded.packId } });
      const review = await prisma.packReview.findUnique({ where: { id: seeded.review.id } });
      const winner = (fulfilled[0] as PromiseFulfilledResult<"approve" | "reject">).value;
      if (winner === "approve") {
        assert.equal(pack?.status, PackStatus.PUBLISHED);
        assert.equal(review?.status, PackReviewStatus.APPROVED);
      } else {
        assert.equal(pack?.status, PackStatus.DRAFT);
        assert.equal(review?.status, PackReviewStatus.REJECTED);
      }
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

  it("fingerprint mismatch blocks when DB snapshot changed after integrity verify", async () => {
    const suffix = `${Date.now()}-fp`;
    const seeded = await seedApprovalReadyPack(suffix);
    try {
      const changed = {
        ...seeded.snapshot,
        embeddingModelRevision: SHA_OTHER,
      };
      await prisma.packReview.update({
        where: { id: seeded.review.id },
        data: { submitSnapshot: changed as unknown as Prisma.InputJsonValue },
      });
      await assert.rejects(
        () =>
          prisma.$transaction(async (tx) => {
            await assertApprovalSearchGenerationInTx(tx, {
              packId: seeded.packId,
              reviewId: seeded.review.id,
              expectedSnapshotFingerprint: seeded.snapshotFingerprint,
            });
          }),
        (error: unknown) =>
          error instanceof PayloadServiceError && error.code === "APPROVAL_SNAPSHOT_MISMATCH",
      );
      const pack = await prisma.knowledgePack.findUnique({ where: { packId: seeded.packId } });
      const gen = await prisma.searchIndexGeneration.findUnique({
        where: { id: seeded.generation.id },
      });
      assert.equal(pack?.status, PackStatus.REVIEWING);
      assert.equal(gen?.status, "READY");
      assert.equal(gen?.scope, "DRAFT");
    } finally {
      await cleanup(seeded.packId);
    }
  });

  it("null searchIndexGenerationId on run fails service evidence", async () => {
    const suffix = `${Date.now()}-nullgen`;
    const seeded = await seedApprovalReadyPack(suffix);
    try {
      await prisma.serviceValidationRun.update({
        where: { id: seeded.runIds.API },
        data: { searchIndexGenerationId: null },
      });
      await assert.rejects(
        () =>
          prisma.$transaction(async (tx) => {
            const evidence = await assertApprovalSearchGenerationInTx(tx, {
              packId: seeded.packId,
              reviewId: seeded.review.id,
              expectedSnapshotFingerprint: seeded.snapshotFingerprint,
            });
            await assertCurrentServiceValidationEvidence({
              client: tx,
              packId: seeded.packId,
              versionId: evidence.versionId,
              snapshot: evidence.snapshot,
            });
          }),
        (error: unknown) =>
          error instanceof PayloadServiceError &&
          error.code === "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
      );
    } finally {
      await cleanup(seeded.packId);
    }
  });

  it("missing API resultFingerprint in snapshot fails preparation entry", async () => {
    const suffix = `${Date.now()}-norf`;
    const seeded = await seedApprovalReadyPack(suffix);
    try {
      const bad = {
        ...seeded.snapshot,
        preparationValidation: {
          ...seeded.snapshot.preparationValidation!,
          API: {
            ...seeded.snapshot.preparationValidation!.API!,
            resultFingerprint: null,
          },
        },
      };
      await prisma.packReview.update({
        where: { id: seeded.review.id },
        data: { submitSnapshot: bad as unknown as Prisma.InputJsonValue },
      });
      await assert.rejects(
        () =>
          prisma.$transaction(async (tx) => {
            await assertApprovalSearchGenerationInTx(tx, {
              packId: seeded.packId,
              reviewId: seeded.review.id,
              expectedSnapshotFingerprint: computeReviewSubmitSnapshotFingerprint(bad as never),
            });
          }),
        (error: unknown) =>
          error instanceof PayloadServiceError && error.code === "APPROVAL_SNAPSHOT_MISMATCH",
      );
    } finally {
      await cleanup(seeded.packId);
    }
  });

  it("approvePackReview vs rejectPackReview: exactly one wins", async () => {
    const suffix = `${Date.now()}-e2e`;
    const seeded = await seedApprovalReadyPack(suffix, { fullIntegrity: true });
    assert.ok(seeded.storage);
    setObjectStorageForTests(seeded.storage);
    try {
      const results = await Promise.allSettled([
        approvePackReview({
          packId: seeded.packId,
          reviewerUserId: seeded.userId,
          reviewerClientId: "test-approve",
          storage: seeded.storage!,
        }),
        rejectPackReview({
          packId: seeded.packId,
          reviewerUserId: seeded.userId,
          reviewerClientId: "test-reject",
          rejectionReason: "concurrency-test",
        }),
      ]);

      const outcomes = results.map((r) => {
        if (r.status !== "fulfilled") return { kind: "throw" as const };
        const v = r.value;
        if ("error" in v && v.error) {
          return { kind: "error" as const, error: v.error };
        }
        return { kind: "ok" as const };
      });
      const oks = outcomes.filter((o) => o.kind === "ok");
      assert.equal(oks.length, 1, `expected 1 success, got ${JSON.stringify(outcomes)}`);
      assert.ok(
        outcomes.some((o) => o.kind === "error"),
        `expected conflict side, got ${JSON.stringify(outcomes)}`,
      );

      const pack = await prisma.knowledgePack.findUnique({ where: { packId: seeded.packId } });
      const review = await prisma.packReview.findUnique({ where: { id: seeded.review.id } });
      const gen = await prisma.searchIndexGeneration.findUnique({
        where: { id: seeded.generation.id },
      });
      const approveAudits = await prisma.auditLog.count({
        where: { entityId: seeded.packId, action: AuditAction.ADMIN_PACK_APPROVE },
      });
      const rejectAudits = await prisma.auditLog.count({
        where: { entityId: seeded.packId, action: AuditAction.ADMIN_PACK_REJECT },
      });

      if (pack?.status === PackStatus.PUBLISHED || pack?.status === PackStatus.VERIFIED) {
        assert.equal(review?.status, PackReviewStatus.APPROVED);
        assert.equal(gen?.status, "PROMOTED");
        assert.equal(gen?.scope, "PRODUCTION");
        assert.equal(approveAudits, 1);
        assert.equal(rejectAudits, 0);
      } else {
        assert.equal(pack?.status, PackStatus.DRAFT);
        assert.equal(review?.status, PackReviewStatus.REJECTED);
        assert.equal(gen?.status, "READY");
        assert.equal(gen?.scope, "DRAFT");
        assert.equal(rejectAudits, 1);
        assert.equal(approveAudits, 0);
      }
    } finally {
      setObjectStorageForTests(null);
      await cleanup(seeded.packId);
    }
  });


});

describe("approval transaction atomicity (skipped without DATABASE_URL)", {
  skip: hasDb,
}, () => {
  it("reports skip ??PostgreSQL not configured", () => {
    assert.equal(hasDb, false);
  });
});
