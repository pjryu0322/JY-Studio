/**
 * Source fingerprint change → structure/search STALE (isolated test DB).
 * Requires JYKSTORE_DB_TESTS=1 and DATABASE_URL path containing "test".
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
import {
  getDoclingKnowledgePipelineStatus,
  isDoclingStructurePassed,
} from "../lib/docling-knowledge/docling-knowledge-pipeline-service.ts";
import { DOCLING_KNOWLEDGE_PIPELINE_TRIGGER } from "../lib/docling-knowledge/docling-knowledge-stages.ts";
import { resolveProviderRegistrationReadiness } from "../lib/provider-registration-readiness.ts";
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
if (!runDb) {
  console.warn(
    "DB tests: SKIPPED — set JYKSTORE_DB_TESTS=1 and use a DATABASE_URL whose path contains 'test'",
  );
}

describe("source change STALE (isolated test DB)", { skip: !runDb }, () => {
  it("fingerprint change makes structurePassed false and blocks submit", async () => {
    const suffix = randomUUID().slice(0, 8);
    const packId = `sd-stale-${suffix}`;
    const clientId = `stale-client-${suffix}`;
    const category =
      (await prisma.packCategory.findFirst({ select: { categoryId: true } })) ??
      (await prisma.packCategory.create({
        data: {
          categoryId: `sd-stale-cat-${suffix}`,
          name: "ST",
          description: "t",
          icon: "book",
        },
      }));
    const user = await prisma.user.create({
      data: {
        email: `sd-stale-${suffix}@example.com`,
        name: "ST",
        accountRole: "PROVIDER",
      },
    });
    const profile = await prisma.providerProfile.create({
      data: {
        displayName: "ST",
        description: "t",
        userId: user.id,
        clientId,
        status: "ACTIVE",
      },
    });
    await prisma.knowledgePack.create({
      data: {
        packId,
        name: "ST Pack",
        categoryId: category.categoryId,
        providerName: "ST",
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
        id: `sd-stale-b-${suffix}`,
        packId,
        versionId: version.id,
        status: "REVIEW_READY",
        storageStatus: "ACTIVE",
        isActive: true,
      },
    });
    const fpA = `fp-a-${suffix}`;
    const nd = await prisma.normalizedDocument.create({
      data: {
        id: `sd-stale-nd-${suffix}`,
        bundleId: bundle.id,
        packId,
        versionId: version.id,
        adapterVersion: "test",
        fingerprint: fpA,
        isActive: true,
        title: "doc",
      },
    });
    const genId = `sd-stale-gen-${suffix}`;
    const binding = createKnowledgeRunBinding({
      versionId: version.id,
      normalizedDocumentId: nd.id,
      fingerprint: fpA,
      bundleId: bundle.id,
      indexGenerationId: genId,
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
      { step: "STRUCTURE_VALIDATING" as PipelineStatus, details: { advisory: true } },
      { step: "KNOWLEDGE_CHECKING" as PipelineStatus, details: {} },
      {
        step: "CHUNKING" as PipelineStatus,
        details: { chunkCount: 3, tokenGateStatus: "PASS" },
      },
      { step: "INDEXING" as PipelineStatus, details: {} },
      {
        step: "SEARCH_EVALUATING" as PipelineStatus,
        details: { retrievalRankingPolicyVersion: "relevance_diversity_v2" },
      },
      { step: "READY_FOR_REVIEW" as PipelineStatus, details: {} },
    ]) {
      await prisma.pipelineStep.create({
        data: {
          runId: pipeline.id,
          packId,
          step: step.step,
          status: "PASS",
          message: "ok",
          details: step.details,
          startedAt: new Date(),
          finishedAt: new Date(),
        },
      });
    }

    try {
      assert.equal(await isDoclingStructurePassed(packId), true);
      const before = await getDoclingKnowledgePipelineStatus({
        userId: user.id,
        clientId,
        packId,
      });
      assert.ok(!("error" in before));
      assert.equal(before.pipelineCurrent, true);
      assert.equal(before.structurePassed, true);

      // Real source change path: fingerprint update on active ND (material replace).
      await prisma.normalizedDocument.update({
        where: { id: nd.id },
        data: { fingerprint: `fp-b-${suffix}` },
      });

      assert.equal(await isDoclingStructurePassed(packId), false);
      const after = await getDoclingKnowledgePipelineStatus({
        userId: user.id,
        clientId,
        packId,
      });
      assert.ok(!("error" in after));
      assert.equal(after.pipelineCurrent, false);
      assert.equal(after.structurePassed, false);
      assert.equal(after.stale, true);

      const readiness = resolveProviderRegistrationReadiness({
        packId,
        packStatus: "DRAFT",
        basicInfoReady: true,
        sourceMaterialsReady: true,
        structurePassed: after.structurePassed,
        searchFoundationPassed: after.searchFoundationPassed,
        allPreparationChannelsPassed: true,
        distributionMetadataReady: true,
        pipelineCurrent: after.pipelineCurrent,
      });
      assert.equal(readiness.canSubmitReview, false);
      assert.ok(readiness.submitBlockers.includes("DATA_STRUCTURE") || readiness.submitBlockers.includes("BINDING_STALE"));
    } finally {
      await prisma.pipelineStep.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.pipelineRun.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.normalizedDocument.deleteMany({ where: { id: nd.id } }).catch(() => undefined);
      await prisma.doclingImportBundle.deleteMany({ where: { id: bundle.id } }).catch(() => undefined);
      await prisma.knowledgePackVersion.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.knowledgePack.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.providerProfile.deleteMany({ where: { id: profile.id } }).catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: user.id } }).catch(() => undefined);
    }
  });
});
