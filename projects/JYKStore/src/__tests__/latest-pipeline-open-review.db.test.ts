/**
 * Latest PipelineRun binding + Open Review execution gates (PostgreSQL).
 * Skips when DATABASE_URL is unset — never fake PASS.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PackStatus } from "@prisma/client";
import { isPayloadServiceError } from "../lib/distribution/payload-errors.ts";
import {
  resolveValidationBindingState,
} from "../lib/distribution/service-validation-binding.ts";
import {
  assertNoOpenPackReview,
  getServiceValidationStatus,
  resolveSearchEvaluationValidity,
  resolveValidationLockReason,
  runServiceChannelValidation,
} from "../lib/distribution/service-validation-service.ts";
import {
  createKnowledgeRunBinding,
  serializeKnowledgeRunBinding,
} from "../lib/docling-knowledge/docling-knowledge-run-binding.ts";
import { DOCLING_KNOWLEDGE_PIPELINE_TRIGGER } from "../lib/docling-knowledge/docling-knowledge-stages.ts";
import { PackReviewStatus } from "../lib/pack-review-status.ts";
import { prisma } from "../lib/prisma.ts";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "../lib/retrieval/relevance-diversity-rerank.ts";

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

async function seedPack(suffix: string) {
  const packId = `lp-pack-${suffix}`;
  const clientId = `lp-client-${suffix}`;
  const category =
    (await prisma.packCategory.findFirst({ select: { categoryId: true } })) ??
    (await prisma.packCategory.create({
      data: { categoryId: `lp-cat-${suffix}`, name: "LP Cat", description: "t" },
    }));
  const user = await prisma.user.create({
    data: { email: `lp-${suffix}@example.com`, name: "LP", accountRole: "PROVIDER" },
  });
  const profile = await prisma.providerProfile.create({
    data: {
      displayName: "LP",
      description: "t",
      userId: user.id,
      clientId,
      status: "ACTIVE",
    },
  });
  await prisma.knowledgePack.create({
    data: {
      packId,
      name: "LP Pack",
      categoryId: category.categoryId,
      providerName: "LP",
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
    normalizedDocumentId: `nd-${suffix}`,
    fingerprint: `fp-${suffix}`,
    bundleId: `b-${suffix}`,
    indexGenerationId: `gen-${suffix}`,
  });
  const passRun = await prisma.pipelineRun.create({
    data: {
      packId,
      triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
      status: "PASS",
      summary: serializeKnowledgeRunBinding(binding),
      startedAt: new Date("2026-07-01T00:00:00.000Z"),
      finishedAt: new Date("2026-07-01T01:00:00.000Z"),
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
  await prisma.pipelineStepLog.createMany({
    data: [
      { runId: passRun.id, packId, step: "INDEXING", status: "PASS" },
      {
        runId: passRun.id,
        packId,
        step: "SEARCH_EVALUATING",
        status: "PASS",
        details: { retrievalRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION },
      },
    ],
  });
  return {
    packId,
    clientId,
    user,
    profile,
    version,
    binding,
    passRun,
    categoryId: category.categoryId,
  };
}

async function cleanupSeed(input: {
  packId: string;
  userId: string;
  profileId: string;
}) {
  await prisma.packReview.deleteMany({ where: { packId: input.packId } }).catch(() => undefined);
  await prisma.serviceValidationRun.deleteMany({ where: { packId: input.packId } }).catch(() => undefined);
  await prisma.pipelineStepLog.deleteMany({ where: { packId: input.packId } }).catch(() => undefined);
  await prisma.searchIndexGeneration.deleteMany({ where: { packId: input.packId } }).catch(() => undefined);
  await prisma.normalizedDocument.deleteMany({ where: { packId: input.packId } }).catch(() => undefined);
  await prisma.knowledgePackFile.deleteMany({ where: { packId: input.packId } }).catch(() => undefined);
  await prisma.doclingImportBundle.deleteMany({ where: { packId: input.packId } }).catch(() => undefined);
  await prisma.pipelineRun.deleteMany({ where: { packId: input.packId } }).catch(() => undefined);
  await prisma.packDistributionMetadata.deleteMany({ where: { packId: input.packId } }).catch(() => undefined);
  await prisma.knowledgePackVersion.deleteMany({ where: { packId: input.packId } }).catch(() => undefined);
  await prisma.knowledgePack.deleteMany({ where: { packId: input.packId } }).catch(() => undefined);
  await prisma.providerProfile.deleteMany({ where: { id: input.profileId } }).catch(() => undefined);
  await prisma.user.deleteMany({ where: { id: input.userId } }).catch(() => undefined);
}

describe("latest pipeline binding + open review (unit)", () => {
  it("maps binding states to lock reasons without DB", () => {
    assert.equal(
      resolveValidationLockReason({
        packStatus: "DRAFT",
        bindingStatus: "NOT_READY",
      }),
      "SEARCH_DATA_NOT_READY",
    );
    assert.equal(
      resolveValidationLockReason({
        packStatus: "DRAFT",
        bindingStatus: "STALE",
      }),
      "BINDING_STALE",
    );
    assert.deepEqual(
      resolveSearchEvaluationValidity({
        status: "PASS",
        details: { retrievalRankingPolicyVersion: "relevance_diversity_v1" },
        expectedRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
      }),
      { current: false, reason: "RANKING_POLICY_STALE" },
    );
  });
});

describe("latest pipeline binding + open review (postgres)", { skip: !hasDb }, () => {
  it("does not fall back to older PASS when latest run is RUNNING", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const seeded = await seedPack(suffix);
    try {
      await prisma.pipelineRun.create({
        data: {
          packId: seeded.packId,
          triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
          status: "RUNNING",
          startedAt: new Date("2026-07-19T00:00:00.000Z"),
        },
      });
      const state = await resolveValidationBindingState(prisma, {
        packId: seeded.packId,
        versionId: seeded.version.id,
      });
      assert.equal(state.status, "NOT_READY");
      if (state.status === "NOT_READY") {
        assert.equal(state.reason, "LATEST_RUN_RUNNING");
      }
      assert.equal(
        resolveValidationLockReason({
          packStatus: "DRAFT",
          bindingStatus: state.status,
        }),
        "SEARCH_DATA_NOT_READY",
      );
    } finally {
      await cleanupSeed({
        packId: seeded.packId,
        userId: seeded.user.id,
        profileId: seeded.profile.id,
      });
    }
  });

  it("marks latest FAIL as STALE without using older PASS", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const seeded = await seedPack(suffix);
    try {
      await prisma.pipelineRun.create({
        data: {
          packId: seeded.packId,
          triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
          status: "FAIL",
          startedAt: new Date("2026-07-19T00:00:00.000Z"),
          finishedAt: new Date("2026-07-19T01:00:00.000Z"),
        },
      });
      const state = await resolveValidationBindingState(prisma, {
        packId: seeded.packId,
        versionId: seeded.version.id,
      });
      assert.equal(state.status, "STALE");
      if (state.status === "STALE") {
        assert.equal(state.reason, "LATEST_RUN_NOT_PASS");
      }
      assert.equal(
        resolveValidationLockReason({
          packStatus: "DRAFT",
          bindingStatus: state.status,
        }),
        "BINDING_STALE",
      );
    } finally {
      await cleanupSeed({
        packId: seeded.packId,
        userId: seeded.user.id,
        profileId: seeded.profile.id,
      });
    }
  });

  it("keeps CURRENT when the latest run alone is PASS with valid binding", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const seeded = await seedPack(suffix);
    try {
      const state = await resolveValidationBindingState(prisma, {
        packId: seeded.packId,
        versionId: seeded.version.id,
      });
      assert.equal(state.status, "CURRENT");
      if (state.status === "CURRENT") {
        assert.equal(state.binding.pipelineRunId, seeded.passRun.id);
      }
    } finally {
      await cleanupSeed({
        packId: seeded.packId,
        userId: seeded.user.id,
        profileId: seeded.profile.id,
      });
    }
  });

  it("blocks open review before and inside validation execution", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const seeded = await seedPack(suffix);
    try {
      await prisma.packReview.create({
        data: {
          packId: seeded.packId,
          status: PackReviewStatus.PENDING,
          submitSnapshot: {},
        },
      });

      await assert.rejects(
        () => assertNoOpenPackReview(prisma, seeded.packId),
        (err: unknown) => {
          assert.ok(isPayloadServiceError(err));
          assert.equal(err.code, "SERVICE_VALIDATION_NOT_EDITABLE");
          assert.equal(err.httpStatus, 409);
          return true;
        },
      );

      const status = await getServiceValidationStatus({
        userId: seeded.user.id,
        clientId: seeded.clientId,
        packId: seeded.packId,
      });
      assert.equal(status.canRunValidation, false);
      assert.equal(status.validationLockReason, "OPEN_REVIEW");

      const beforeCount = await prisma.serviceValidationRun.count({
        where: { packId: seeded.packId },
      });
      await assert.rejects(
        () =>
          runServiceChannelValidation({
            userId: seeded.user.id,
            clientId: seeded.clientId,
            packId: seeded.packId,
            channel: "API",
            query: "기획단계 대가 산정",
          }),
        (err: unknown) => {
          assert.ok(isPayloadServiceError(err));
          assert.equal(err.code, "SERVICE_VALIDATION_NOT_EDITABLE");
          assert.equal(err.httpStatus, 409);
          return true;
        },
      );
      const afterCount = await prisma.serviceValidationRun.count({
        where: { packId: seeded.packId },
      });
      assert.equal(afterCount, beforeCount);
    } finally {
      await cleanupSeed({
        packId: seeded.packId,
        userId: seeded.user.id,
        profileId: seeded.profile.id,
      });
    }
  });

  it("allows assertNoOpenPackReview when only closed reviews exist", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const seeded = await seedPack(suffix);
    try {
      await prisma.packReview.create({
        data: {
          packId: seeded.packId,
          status: PackReviewStatus.WITHDRAWN,
          submitSnapshot: {},
        },
      });
      await assertNoOpenPackReview(prisma, seeded.packId);
    } finally {
      await cleanupSeed({
        packId: seeded.packId,
        userId: seeded.user.id,
        profileId: seeded.profile.id,
      });
    }
  });
});
