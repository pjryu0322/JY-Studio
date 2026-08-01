/**
 * P9.1 Role E2E (application-service level).
 * Exercises Admin unpublish / restore / new-revision + public retrieval identity.
 * Browser UI automation is not available in-repo (no Playwright harness) — see report.
 *
 * Usage: node --import tsx scripts/p9-1-role-publish-identity-e2e.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { PackStatus } from "@prisma/client";
import {
  DEFAULT_E5_EMBEDDING_DIMENSION,
  DEFAULT_E5_MODEL_ID,
  LOCAL_E5_EMBEDDING_PROVIDER,
} from "../src/lib/embedding/e5-embedding-constants.ts";
import {
  publishNewRevisionAfterUnpublish,
  restorePublishedPackAfterUnpublish,
  unpublishPackReview,
} from "../src/lib/admin-review-service.ts";
import { prisma } from "../src/lib/prisma.ts";
import { executeRetrievalApiRequest } from "../src/lib/retrieval/retrieval-api-adapter.ts";
import { loadPublicRetrievalPack } from "../src/lib/retrieval/retrieval-pack-store.ts";
import { resolvePublicRetrievalGenerationScope } from "../src/lib/retrieval/retrieval-generation-scope.ts";
import {
  STORE_PROVIDER_REVIEW_TRIGGER,
  STORE_SERVICE_VALIDATION_TRIGGER,
} from "../src/lib/store-workflow-markers.ts";
import { encodeProviderReviewConfirmSummary } from "../src/lib/store-workflow-provider-review-binding.ts";

function ensureDatabaseUrlFromDotEnv(): void {
  if (process.env.DATABASE_URL?.trim()) return;
  const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
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
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "tmp-p9-1-e2e");

type Step = {
  scenario: string;
  role: string;
  action: string;
  endpointOrService: string;
  packStatus?: string;
  reviewedGenerationId?: string | null;
  publishedGenerationId?: string | null;
  servedGenerationId?: string | null;
  result: "PASS" | "FAIL";
  detail?: string;
};

const steps: Step[] = [];

function record(step: Step) {
  steps.push(step);
  console.log(
    `[${step.result}] ${step.scenario} / ${step.role} / ${step.action} — ${step.detail ?? ""}`,
  );
}

async function seed(suffix: string) {
  const packId = `p91e2e-${suffix}`;
  const category =
    (await prisma.packCategory.findFirst({ select: { categoryId: true } })) ??
    (await prisma.packCategory.create({
      data: { categoryId: `p91e2e-cat-${suffix}`, name: "P91E2E", description: "t", icon: "book" },
    }));
  const user = await prisma.user.create({
    data: { email: `p91e2e-${suffix}@example.com`, name: "P91E2E", accountRole: "PROVIDER" },
  });
  const profile = await prisma.providerProfile.create({
    data: { displayName: "P91E2E", description: "t", userId: user.id, status: "ACTIVE" },
  });
  await prisma.knowledgePack.create({
    data: {
      packId,
      name: "P91E2E",
      categoryId: category.categoryId,
      providerName: "P91E2E",
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
      summary: "e2e",
      startedAt: new Date(),
      finishedAt: new Date(),
    },
  });
  const bundle = await prisma.doclingImportBundle.create({
    data: {
      id: `p91e2e-b-${suffix}`,
      packId,
      versionId: version.id,
      status: "REVIEW_READY",
      storageStatus: "ACTIVE",
      isActive: true,
    },
  });
  const normalized = await prisma.normalizedDocument.create({
    data: {
      id: `p91e2e-nd-${suffix}`,
      bundleId: bundle.id,
      packId,
      versionId: version.id,
      adapterVersion: "test",
      fingerprint: `p91e2e-fp-${suffix}`,
      isActive: true,
    },
  });
  const source = await prisma.sourceDocument.create({
    data: {
      id: `p91e2e-src-${suffix}`,
      versionId: version.id,
      title: "SpanMergingField",
      content: "cell merge",
    },
  });
  const production = await prisma.searchIndexGeneration.create({
    data: {
      id: `p91e2e-gen-${suffix}-a`,
      packId,
      versionId: version.id,
      pipelineRunId: pipeline.id,
      normalizedDocumentId: normalized.id,
      chunkGenerationId: `p91e2e-cg-${suffix}-a`,
      fingerprint: `p91e2e-gfp-${suffix}-a`,
      embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
      embeddingModel: DEFAULT_E5_MODEL_ID,
      embeddingModelRevision: SHA,
      embeddingDimension: DEFAULT_E5_EMBEDDING_DIMENSION,
      distanceMetric: "cosine",
      status: "PROMOTED",
      scope: "PRODUCTION",
      generationFingerprint: `p91e2e-gf-${suffix}-a`,
      chunkCount: 1,
      embeddedCount: 1,
      promotedAt: new Date(),
    },
  });
  await prisma.knowledgeChunk.create({
    data: {
      id: `p91e2e-chunk-${suffix}`,
      versionId: version.id,
      sourceDocumentId: source.id,
      chunkType: "retrieval",
      title: "SpanMergingField",
      content: "SpanMergingField merges adjacent equal cell values",
      tags: [],
      chunkGenerationId: production.chunkGenerationId,
      metadata: {
        searchIndexGenerationId: production.id,
        indexGenerationId: production.chunkGenerationId,
      },
      isActive: true,
    },
  });
  return {
    packId,
    versionId: version.id,
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

async function main() {
  mkdirSync(outDir, { recursive: true });
  const suffix = randomUUID().slice(0, 8);
  const seeded = await seed(suffix);

  try {
    // Scenario 1 — already published A served to user
    const served1 = await resolvePublicRetrievalGenerationScope(seeded.versionId);
    const user1 = await executeRetrievalApiRequest({
      knowledgePackId: seeded.packId,
      query: "SpanMergingField",
      topK: 2,
      retrievalMode: "keyword",
      requestId: `p91e2e_s1_${suffix}`,
      serviceChannel: "MCP",
      executionMode: "PUBLIC",
    });
    record({
      scenario: "1-published-serve",
      role: "User",
      action: "MCP/public retrieval",
      endpointOrService: "executeRetrievalApiRequest",
      packStatus: "PUBLISHED",
      publishedGenerationId: seeded.productionId,
      servedGenerationId: served1.searchIndexGenerationId,
      result: user1.ok && served1.searchIndexGenerationId === seeded.productionId ? "PASS" : "FAIL",
      detail: `served=${served1.searchIndexGenerationId}`,
    });

    // Scenario 2 — unpublish → restore existing A
    await unpublishPackReview({ packId: seeded.packId, memo: "role e2e unpublish" });
    const blocked = await loadPublicRetrievalPack(seeded.packId);
    record({
      scenario: "2-unpublish-block",
      role: "User",
      action: "public pack load",
      endpointOrService: "loadPublicRetrievalPack",
      packStatus: "DRAFT",
      result: blocked === null ? "PASS" : "FAIL",
    });

    const restore = await restorePublishedPackAfterUnpublish({
      packId: seeded.packId,
      memo: "role e2e restore",
    });
    const served2 = await resolvePublicRetrievalGenerationScope(seeded.versionId);
    record({
      scenario: "2-restore-existing",
      role: "Admin",
      action: "기존 게시본 다시 게시",
      endpointOrService: "restorePublishedPackAfterUnpublish",
      packStatus: "error" in restore && restore.error ? "DRAFT" : "PUBLISHED",
      publishedGenerationId: restore.restoredGenerationId,
      servedGenerationId: served2.searchIndexGenerationId,
      result:
        !("error" in restore && restore.error) &&
        restore.restoredGenerationId === seeded.productionId &&
        served2.searchIndexGenerationId === seeded.productionId
          ? "PASS"
          : "FAIL",
      detail: JSON.stringify(
        "error" in restore && restore.error
          ? restore
          : { restored: restore.restoredGenerationId, served: served2.searchIndexGenerationId },
      ),
    });

    // Scenario 3 — unpublish → draft B → block restore → publish B
    await unpublishPackReview({ packId: seeded.packId, memo: "role e2e unpublish 2" });
    const draftB = await prisma.searchIndexGeneration.create({
      data: {
        id: `p91e2e-gen-${suffix}-b`,
        packId: seeded.packId,
        versionId: seeded.versionId,
        pipelineRunId: seeded.pipelineId,
        normalizedDocumentId: seeded.normalizedId,
        chunkGenerationId: `p91e2e-cg-${suffix}-b`,
        fingerprint: `p91e2e-gfp-${suffix}-b`,
        embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
        embeddingModel: DEFAULT_E5_MODEL_ID,
        embeddingModelRevision: SHA,
        embeddingDimension: DEFAULT_E5_EMBEDDING_DIMENSION,
        distanceMetric: "cosine",
        status: "READY",
        scope: "DRAFT",
        generationFingerprint: `p91e2e-gf-${suffix}-b`,
        chunkCount: 1,
        embeddedCount: 1,
      },
    });
    await prisma.pipelineRun.create({
      data: {
        packId: seeded.packId,
        triggerType: STORE_SERVICE_VALIDATION_TRIGGER,
        status: "PASS",
        summary: "sv b",
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
        }),
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });

    const blockedRestore = await restorePublishedPackAfterUnpublish({
      packId: seeded.packId,
      memo: "should fail",
    });
    record({
      scenario: "3-block-restore-when-draft-b",
      role: "Admin",
      action: "restore existing",
      endpointOrService: "restorePublishedPackAfterUnpublish",
      reviewedGenerationId: draftB.id,
      result:
        blockedRestore.error === "INCOMPLETE" && blockedRestore.code === "NEW_REVISION_PENDING"
          ? "PASS"
          : "FAIL",
      detail: JSON.stringify(blockedRestore),
    });

    const published = await publishNewRevisionAfterUnpublish({
      packId: seeded.packId,
      memo: "publish B",
    });
    const served3 = await resolvePublicRetrievalGenerationScope(seeded.versionId);
    const identityOk =
      !("error" in published && published.error) &&
      published.reviewedGenerationId === draftB.id &&
      published.publishedGenerationId === draftB.id &&
      served3.searchIndexGenerationId === draftB.id &&
      served3.searchIndexGenerationId !== seeded.productionId;
    record({
      scenario: "3-new-revision-publish",
      role: "Admin/User",
      action: "새 Revision 게시 + public serve",
      endpointOrService: "publishNewRevisionAfterUnpublish",
      reviewedGenerationId: published.reviewedGenerationId,
      publishedGenerationId: published.publishedGenerationId,
      servedGenerationId: served3.searchIndexGenerationId,
      result: identityOk ? "PASS" : "FAIL",
      detail: JSON.stringify({
        reviewed: published.reviewedGenerationId,
        published: published.publishedGenerationId,
        served: served3.searchIndexGenerationId,
        oldA: seeded.productionId,
      }),
    });
  } finally {
    await seeded.cleanup();
  }

  const failed = steps.filter((s) => s.result === "FAIL");
  const report = {
    browserE2E: "NOT_RUN",
    browserE2EReason: "No Playwright/browser harness in JYKStore; service Role E2E executed instead",
    steps,
    passCount: steps.filter((s) => s.result === "PASS").length,
    failCount: failed.length,
  };
  writeFileSync(join(outDir, "e2e-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (failed.length > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
