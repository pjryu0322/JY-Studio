/**
 * P9 — public retrieval version selection prefers PRODUCTION generation's version.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PackStatus } from "@prisma/client";
import {
  DEFAULT_E5_EMBEDDING_DIMENSION,
  DEFAULT_E5_MODEL_ID,
  LOCAL_E5_EMBEDDING_PROVIDER,
} from "../lib/embedding/e5-embedding-constants.ts";
import { prisma } from "../lib/prisma.ts";
import { loadPublicRetrievalPack } from "../lib/retrieval/retrieval-pack-store.ts";

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

describe("P9 public retrieval version selection (skipped without DATABASE_URL)", {
  skip: !hasDb,
}, () => {
  const cleanups: Array<() => Promise<void>> = [];
  after(async () => {
    for (const fn of cleanups.reverse()) await fn();
  });

  it("serves the version that owns PRODUCTION+PROMOTED, not a newer draft version", async () => {
    const suffix = randomUUID().slice(0, 8);
    const packId = `p9v-pack-${suffix}`;
    const category =
      (await prisma.packCategory.findFirst({ select: { categoryId: true } })) ??
      (await prisma.packCategory.create({
        data: {
          categoryId: `p9v-cat-${suffix}`,
          name: "P9V",
          description: "t",
          icon: "book",
        },
      }));
    const user = await prisma.user.create({
      data: { email: `p9v-${suffix}@example.com`, name: "P9V", accountRole: "PROVIDER" },
    });
    const profile = await prisma.providerProfile.create({
      data: { displayName: "P9V", description: "t", userId: user.id, status: "ACTIVE" },
    });
    await prisma.knowledgePack.create({
      data: {
        packId,
        name: "P9V Pack",
        categoryId: category.categoryId,
        providerName: "P9V",
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

    const older = await prisma.knowledgePackVersion.create({
      data: {
        packId,
        version: "1.0.0",
        overview: "published",
        features: [],
        includedKnowledge: [],
        supportedEnvironments: [],
        targetUsers: [],
        useCases: [],
        versionSummary: "v1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    const newerDraft = await prisma.knowledgePackVersion.create({
      data: {
        packId,
        version: "2.0.0-draft",
        overview: "draft newer",
        features: [],
        includedKnowledge: [],
        supportedEnvironments: [],
        targetUsers: [],
        useCases: [],
        versionSummary: "v2",
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
      },
    });
    await prisma.packDistributionMetadata.create({
      data: {
        packId,
        versionId: older.id,
        licenseName: "MIT",
        visibility: "PUBLIC",
        allowApi: true,
        allowMcp: true,
        allowDownload: false,
      },
    });
    await prisma.packDistributionMetadata.create({
      data: {
        packId,
        versionId: newerDraft.id,
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
        triggerType: "TEST",
        status: "PASS",
        summary: "p9v",
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });
    const bundle = await prisma.doclingImportBundle.create({
      data: {
        id: `p9v-b-${suffix}`,
        packId,
        versionId: older.id,
        status: "REVIEW_READY",
        storageStatus: "ACTIVE",
        isActive: true,
      },
    });
    const normalized = await prisma.normalizedDocument.create({
      data: {
        id: `p9v-nd-${suffix}`,
        bundleId: bundle.id,
        packId,
        versionId: older.id,
        adapterVersion: "test",
        fingerprint: `p9v-fp-${suffix}`,
        isActive: true,
      },
    });
    await prisma.searchIndexGeneration.create({
      data: {
        id: `p9v-prod-${suffix}`,
        packId,
        versionId: older.id,
        pipelineRunId: pipeline.id,
        normalizedDocumentId: normalized.id,
        chunkGenerationId: `p9v-cg-${suffix}`,
        fingerprint: `p9v-gfp-${suffix}`,
        embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
        embeddingModel: DEFAULT_E5_MODEL_ID,
        embeddingModelRevision: SHA,
        embeddingDimension: DEFAULT_E5_EMBEDDING_DIMENSION,
        distanceMetric: "cosine",
        status: "PROMOTED",
        scope: "PRODUCTION",
        generationFingerprint: `p9v-gf-${suffix}`,
        chunkCount: 1,
        embeddedCount: 1,
        promotedAt: new Date(),
      },
    });

    cleanups.push(async () => {
      await prisma.searchIndexGeneration.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.normalizedDocument.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.doclingImportBundle.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.pipelineRun.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.packDistributionMetadata.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.knowledgePackVersion.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.knowledgePack.delete({ where: { packId } }).catch(() => undefined);
      await prisma.providerProfile.delete({ where: { id: profile.id } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    });

    const scope = await loadPublicRetrievalPack(packId);
    assert.ok(scope);
    assert.equal(scope!.versionId, older.id);
    assert.notEqual(scope!.versionId, newerDraft.id);
  });
});
