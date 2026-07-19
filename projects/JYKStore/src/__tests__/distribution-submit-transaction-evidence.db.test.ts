/**
 * §7/§14 — Transaction-internal review submit evidence re-validation.
 * Runs only when DATABASE_URL is set; otherwise SKIP (never fake PASS).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PackStatus } from "@prisma/client";
import {
  assertReviewSubmitEvidenceInTx,
  ReviewSubmitEvidenceError,
} from "../lib/distribution/review-submit-evidence.ts";
import { buildDoclingBundleReviewSubmitSnapshot } from "../lib/distribution/distribution-submit-snapshot.ts";
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

const testedAt = new Date("2026-07-17T00:00:00.000Z");

async function seedReadyPack(suffix: string) {
  const packId = `tx-pack-${suffix}`;
  const category =
    (await prisma.packCategory.findFirst({ select: { categoryId: true } })) ??
    (await prisma.packCategory.create({
      data: { categoryId: `tx-cat-${suffix}`, name: "TX Cat", description: "t" },
    }));
  const user = await prisma.user.create({
    data: { email: `tx-${suffix}@example.com`, name: "TX", accountRole: "PROVIDER" },
  });
  const profile = await prisma.providerProfile.create({
    data: { displayName: "TX", description: "t", userId: user.id, status: "ACTIVE" },
  });
  await prisma.knowledgePack.create({
    data: {
      packId,
      name: "TX Pack",
      categoryId: category.categoryId,
      providerName: "TX",
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
    normalizedDocumentId: `tx-nd-${suffix}`,
    fingerprint: `tx-fp-${suffix}`,
    bundleId: `tx-b-${suffix}`,
    indexGenerationId: `tx-gen-${suffix}`,
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
      { runId: pipeline.id, packId, step: "KNOWLEDGE_CHECKING", status: "PASS" },
      { runId: pipeline.id, packId, step: "CHUNKING", status: "PASS", details: { chunkCount: 5 } },
      { runId: pipeline.id, packId, step: "INDEXING", status: "PASS" },
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
      allowDownload: true,
      rightsBasis: "RIGHTS_HOLDER",
      rightsConfirmedAt: new Date(),
    },
  });

  const channels = ["API", "MCP", "DOWNLOAD"] as const;
  const runIds: Record<string, string> = {};
  const confIds: Record<string, string> = {};
  let downloadTestId = "";
  for (const channel of channels) {
    const run = await prisma.serviceValidationRun.create({
      data: {
        packId,
        versionId: version.id,
        channel,
        status: "PASS",
        pipelineRunId: pipeline.id,
        indexGenerationId: binding.indexGenerationId,
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
    status: "PASS",
    runId: runIds[channel]!,
    testedAt: testedAt.toISOString(),
    currentValidity: "CURRENT",
    providerConfirmationStatus: "CONFIRMED",
    providerConfirmationId: confIds[channel]!,
    confirmedAt: testedAt.toISOString(),
    pipelineRunId: pipeline.id,
    normalizedDocumentId: binding.normalizedDocumentId,
    indexGenerationId: binding.indexGenerationId,
    fingerprint: binding.fingerprint,
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
    checksums: { source: "a".repeat(64), json: "b".repeat(64), markdown: null },
    doclingSchemaVersion: "1.1",
    adapterVersion: "test",
    normalizedDocumentId: binding.normalizedDocumentId,
    fingerprint: binding.fingerprint,
    warningCount: 0,
    sourceTitle: "Source",
    licenseName: "MIT",
    visibility: "PUBLIC",
    allowDownload: true,
    allowApi: true,
    allowMcp: true,
    preparationValidation: {
      API: entry("API"),
      MCP: entry("MCP"),
      DOWNLOAD: entry("DOWNLOAD"),
    },
    distributionChannels: { allowApi: true, allowMcp: true, allowDownload: true },
    language: "ko",
    pipelineRunId: pipeline.id,
    indexGenerationId: binding.indexGenerationId,
    retrievalEvaluationStatus: "PASS",
  });

  return { packId, user, profile, version, bundle, snapshot, runIds, suffix };
}

async function cleanup(packId: string, profileId: string, userId: string) {
  await prisma.serviceValidationProviderConfirmation
    .deleteMany({ where: { run: { packId } } })
    .catch(() => undefined);
  await prisma.serviceValidationDownloadTest
    .deleteMany({ where: { run: { packId } } })
    .catch(() => undefined);
  await prisma.serviceValidationResultItem
    .deleteMany({ where: { run: { packId } } })
    .catch(() => undefined);
  await prisma.serviceValidationRun.deleteMany({ where: { packId } }).catch(() => undefined);
  await prisma.packDistributionMetadata.deleteMany({ where: { packId } }).catch(() => undefined);
  await prisma.normalizedDocument.deleteMany({ where: { packId } }).catch(() => undefined);
  await prisma.knowledgePackFile.deleteMany({ where: { packId } }).catch(() => undefined);
  await prisma.doclingImportBundle.deleteMany({ where: { packId } }).catch(() => undefined);
  await prisma.pipelineStepLog.deleteMany({ where: { packId } }).catch(() => undefined);
  await prisma.pipelineRun.deleteMany({ where: { packId } }).catch(() => undefined);
  await prisma.knowledgePackVersion.deleteMany({ where: { packId } }).catch(() => undefined);
  await prisma.knowledgePack.deleteMany({ where: { packId } }).catch(() => undefined);
  await prisma.providerProfile.deleteMany({ where: { id: profileId } }).catch(() => undefined);
  await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
}

describe("review submit transaction evidence (§7/§14)", { skip: !hasDb }, () => {
  it("passes for a fully current three-channel binding", async () => {
    const suffix = `${Date.now()}-ok`;
    const s = await seedReadyPack(suffix);
    try {
      await assertReviewSubmitEvidenceInTx(prisma, {
        packId: s.packId,
        versionId: s.version.id,
        providerProfileId: s.profile.id,
        snapshot: s.snapshot,
      });
    } finally {
      await cleanup(s.packId, s.profile.id, s.user.id);
    }
  });

  it("fails when a validation run is invalidated mid-flight", async () => {
    const suffix = `${Date.now()}-inval`;
    const s = await seedReadyPack(suffix);
    await prisma.serviceValidationRun.update({
      where: { id: s.runIds.API! },
      data: { invalidatedAt: new Date() },
    });
    try {
      await assert.rejects(
        () =>
          assertReviewSubmitEvidenceInTx(prisma, {
            packId: s.packId,
            versionId: s.version.id,
            providerProfileId: s.profile.id,
            snapshot: s.snapshot,
          }),
        (e: unknown) =>
          e instanceof ReviewSubmitEvidenceError && e.code === "VALIDATION_DRIFT",
      );
    } finally {
      await cleanup(s.packId, s.profile.id, s.user.id);
    }
  });

  it("fails when the active bundle is swapped", async () => {
    const suffix = `${Date.now()}-bundle`;
    const s = await seedReadyPack(suffix);
    await prisma.doclingImportBundle.update({
      where: { id: s.bundle.id },
      data: { isActive: false },
    });
    try {
      await assert.rejects(
        () =>
          assertReviewSubmitEvidenceInTx(prisma, {
            packId: s.packId,
            versionId: s.version.id,
            providerProfileId: s.profile.id,
            snapshot: s.snapshot,
          }),
        (e: unknown) => e instanceof ReviewSubmitEvidenceError,
      );
    } finally {
      await cleanup(s.packId, s.profile.id, s.user.id);
    }
  });

  it("fails when the distribution channels change after snapshot", async () => {
    const suffix = `${Date.now()}-dist`;
    const s = await seedReadyPack(suffix);
    await prisma.packDistributionMetadata.update({
      where: { versionId: s.version.id },
      data: { allowDownload: false },
    });
    try {
      await assert.rejects(
        () =>
          assertReviewSubmitEvidenceInTx(prisma, {
            packId: s.packId,
            versionId: s.version.id,
            providerProfileId: s.profile.id,
            snapshot: s.snapshot,
          }),
        (e: unknown) =>
          e instanceof ReviewSubmitEvidenceError && e.code === "DISTRIBUTION_DRIFT",
      );
    } finally {
      await cleanup(s.packId, s.profile.id, s.user.id);
    }
  });

  it("fails when a provider confirmation is revoked", async () => {
    const suffix = `${Date.now()}-conf`;
    const s = await seedReadyPack(suffix);
    await prisma.serviceValidationProviderConfirmation.updateMany({
      where: { runId: s.runIds.MCP! },
      data: { status: "NOT_REVIEWED" },
    });
    try {
      await assert.rejects(
        () =>
          assertReviewSubmitEvidenceInTx(prisma, {
            packId: s.packId,
            versionId: s.version.id,
            providerProfileId: s.profile.id,
            snapshot: s.snapshot,
          }),
        (e: unknown) =>
          e instanceof ReviewSubmitEvidenceError && e.code === "CONFIRMATION_DRIFT",
      );
    } finally {
      await cleanup(s.packId, s.profile.id, s.user.id);
    }
  });
});
