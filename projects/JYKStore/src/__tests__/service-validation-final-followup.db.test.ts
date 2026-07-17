import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PackStatus } from "@prisma/client";
import { PayloadServiceError } from "../lib/distribution/payload-errors.ts";
import { commitSuccessfulDownloadTestEvidence } from "../lib/distribution/service-validation-confirmation-service.ts";
import { evidenceIntegrityForRun } from "../lib/distribution/service-validation-binding.ts";
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

async function seedDownloadRun(suffix: string) {
  const packId = `sv-pack-${suffix}`;
  const category =
    (await prisma.packCategory.findFirst({ select: { categoryId: true } })) ??
    (await prisma.packCategory.create({
      data: {
        categoryId: `sv-cat-${suffix}`,
        name: "SV Cat",
        description: "test",
      },
    }));
  const user = await prisma.user.create({
    data: { email: `sv-${suffix}@example.com`, name: "SV Test", accountRole: "PROVIDER" },
  });
  const profile = await prisma.providerProfile.create({
    data: {
      displayName: "SV",
      description: "test",
      userId: user.id,
      status: "ACTIVE",
    },
  });
  await prisma.knowledgePack.create({
    data: {
      packId,
      name: "SV Pack",
      categoryId: category.categoryId,
      providerName: "SV",
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
      packId,
      versionId: version.id,
      status: "REVIEW_READY",
      storageStatus: "ACTIVE",
      isActive: true,
    },
  });
  const file = await prisma.knowledgePackFile.create({
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
  const run = await prisma.serviceValidationRun.create({
    data: {
      packId,
      versionId: version.id,
      channel: "DOWNLOAD",
      status: "PASS",
      pipelineRunId: pipeline.id,
      indexGenerationId: binding.indexGenerationId,
      normalizedDocumentId: binding.normalizedDocumentId,
      fingerprint: binding.fingerprint,
      testedAt: new Date(),
      testedByUserId: user.id,
      details: { fileId: file.id, fileName: file.originalFileName },
    },
  });
  return { packId, user, profile, version, file, run, categoryId: category.categoryId };
}

async function cleanupSeed(input: {
  packId: string;
  userId: string;
  profileId: string;
  categoryId?: string;
}) {
  await prisma.serviceValidationDownloadTest
    .deleteMany({ where: { run: { packId: input.packId } } })
    .catch(() => undefined);
  await prisma.serviceValidationRun.deleteMany({ where: { packId: input.packId } }).catch(() => undefined);
  await prisma.knowledgePackFile.deleteMany({ where: { packId: input.packId } }).catch(() => undefined);
  await prisma.doclingImportBundle.deleteMany({ where: { packId: input.packId } }).catch(() => undefined);
  await prisma.pipelineRun.deleteMany({ where: { packId: input.packId } }).catch(() => undefined);
  await prisma.knowledgePackVersion.deleteMany({ where: { packId: input.packId } }).catch(() => undefined);
  await prisma.knowledgePack.deleteMany({ where: { packId: input.packId } }).catch(() => undefined);
  await prisma.providerProfile.deleteMany({ where: { id: input.profileId } }).catch(() => undefined);
  await prisma.user.deleteMany({ where: { id: input.userId } }).catch(() => undefined);
}

describe("service validation evidence integrity (unit)", () => {
  it("marks pipeline field drift as INVALID without treating old versions as invalid solely by age", () => {
    const binding = {
      pipelineRunId: "pipe-1",
      versionId: "v1",
      indexGenerationId: "g1",
      normalizedDocumentId: "nd1",
      fingerprint: "fp1",
    };
    assert.equal(
      evidenceIntegrityForRun(
        {
          status: "PASS",
          pipelineRunId: "pipe-1",
          indexGenerationId: "g1",
          fingerprint: "fp1",
          normalizedDocumentId: "nd1",
          invalidatedAt: null,
        },
        binding,
      ),
      "VALID",
    );
    assert.equal(
      evidenceIntegrityForRun(
        {
          status: "PASS",
          pipelineRunId: "pipe-1",
          indexGenerationId: "g2",
          fingerprint: "fp1",
          normalizedDocumentId: "nd1",
          invalidatedAt: null,
        },
        binding,
      ),
      "INVALID",
    );
  });
});

describe("service validation final follow-up postgres", { skip: !hasDb }, () => {
  it("createMany skipDuplicates keeps one download evidence under concurrency", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const seeded = await seedDownloadRun(suffix);
    try {
      const results = await Promise.all([
        commitSuccessfulDownloadTestEvidence({
          userId: seeded.user.id,
          packId: seeded.packId,
          versionId: seeded.version.id,
          runId: seeded.run.id,
          fileId: seeded.file.id,
        }),
        commitSuccessfulDownloadTestEvidence({
          userId: seeded.user.id,
          packId: seeded.packId,
          versionId: seeded.version.id,
          runId: seeded.run.id,
          fileId: seeded.file.id,
        }),
      ]);
      assert.equal(results.length, 2);
      assert.ok(results.every((r) => r.fileId === seeded.file.id));
      assert.equal(results[0]!.testedAt, results[1]!.testedAt);
      const count = await prisma.serviceValidationDownloadTest.count({
        where: { runId: seeded.run.id },
      });
      assert.equal(count, 1);
      assert.equal(results.filter((r) => r.created).length, 1);
    } finally {
      await cleanupSeed({
        packId: seeded.packId,
        userId: seeded.user.id,
        profileId: seeded.profile.id,
      });
    }
  });

  it("blocks evidence commit after pack leaves DRAFT", async () => {
    const suffix = `${Date.now()}-draft`;
    const seeded = await seedDownloadRun(suffix);
    await prisma.knowledgePack.update({
      where: { packId: seeded.packId },
      data: { status: PackStatus.REVIEWING },
    });
    try {
      await assert.rejects(
        () =>
          commitSuccessfulDownloadTestEvidence({
            userId: seeded.user.id,
            packId: seeded.packId,
            versionId: seeded.version.id,
            runId: seeded.run.id,
            fileId: seeded.file.id,
          }),
        (err: unknown) =>
          err instanceof PayloadServiceError && err.code === "SERVICE_VALIDATION_NOT_EDITABLE",
      );
      const count = await prisma.serviceValidationDownloadTest.count({
        where: { runId: seeded.run.id },
      });
      assert.equal(count, 0);
    } finally {
      await cleanupSeed({
        packId: seeded.packId,
        userId: seeded.user.id,
        profileId: seeded.profile.id,
      });
    }
  });
});
