/**
 * P9.1 Browser Role E2E — Playwright session + UI navigation + admin API actions.
 * Seeds disposable packs only (never mutates unrelated packs).
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
import { prisma } from "../src/lib/prisma.ts";
import { loadPublicRetrievalPack } from "../src/lib/retrieval/retrieval-pack-store.ts";
import { resolvePublicRetrievalGenerationScope } from "../src/lib/retrieval/retrieval-generation-scope.ts";
import {
  STORE_PROVIDER_REVIEW_TRIGGER,
  STORE_SERVICE_VALIDATION_TRIGGER,
} from "../src/lib/store-workflow-markers.ts";
import { encodeProviderReviewConfirmSummary } from "../src/lib/store-workflow-provider-review-binding.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "tmp-p9-1-browser-e2e");
const baseUrl = process.env.P91_BASE_URL?.trim() || "http://localhost:3004";
const SHA = "fcfc26bf355882620c48df58be112275bd756f50";

type CaseResult = {
  caseId: "A" | "B" | "C";
  result: "PASS" | "FAIL" | "BLOCKED";
  detail: string;
  evidence?: Record<string, unknown>;
};

async function ensureBrowserAdminUser(suffix: string) {
  const email = `p91-browser-admin-${suffix}@jyk.local`.toLowerCase();
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: "P91 Browser Admin", accountRole: "ADMIN" },
    update: { accountRole: "ADMIN", name: "P91 Browser Admin" },
  });
  return {
    email: user.email,
    cleanup: async () => {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    },
  };
}

async function seedPublishedPack(suffix: string) {
  const packId = `p91br-${suffix}`;
  const category =
    (await prisma.packCategory.findFirst({ select: { categoryId: true } })) ??
    (await prisma.packCategory.create({
      data: { categoryId: `p91br-cat-${suffix}`, name: "P91BR", description: "t", icon: "book" },
    }));
  const user = await prisma.user.create({
    data: { email: `p91br-${suffix}@example.com`, name: "P91BR", accountRole: "PROVIDER" },
  });
  const profile = await prisma.providerProfile.create({
    data: { displayName: "P91BR", description: "t", userId: user.id, status: "ACTIVE" },
  });
  await prisma.knowledgePack.create({
    data: {
      packId,
      name: "P91 Browser Pack",
      categoryId: category.categoryId,
      providerName: "P91BR",
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
      summary: "browser-e2e",
      startedAt: new Date(),
      finishedAt: new Date(),
    },
  });
  const bundle = await prisma.doclingImportBundle.create({
    data: {
      id: `p91br-b-${suffix}`,
      packId,
      versionId: version.id,
      status: "REVIEW_READY",
      storageStatus: "ACTIVE",
      isActive: true,
    },
  });
  const normalized = await prisma.normalizedDocument.create({
    data: {
      id: `p91br-nd-${suffix}`,
      bundleId: bundle.id,
      packId,
      versionId: version.id,
      adapterVersion: "test",
      fingerprint: `p91br-fp-${suffix}`,
      isActive: true,
    },
  });
  const production = await prisma.searchIndexGeneration.create({
    data: {
      id: `p91br-gen-${suffix}-a`,
      packId,
      versionId: version.id,
      pipelineRunId: pipeline.id,
      normalizedDocumentId: normalized.id,
      chunkGenerationId: `p91br-cg-${suffix}-a`,
      fingerprint: `p91br-gfp-${suffix}-a`,
      embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
      embeddingModel: DEFAULT_E5_MODEL_ID,
      embeddingModelRevision: SHA,
      embeddingDimension: DEFAULT_E5_EMBEDDING_DIMENSION,
      distanceMetric: "cosine",
      status: "PROMOTED",
      scope: "PRODUCTION",
      generationFingerprint: `p91br-gf-${suffix}-a`,
      chunkCount: 1,
      embeddedCount: 1,
      promotedAt: new Date(),
    },
  });

  return {
    packId,
    versionId: version.id,
    productionId: production.id,
    pipelineId: pipeline.id,
    normalizedId: normalized.id,
    async cleanup() {
      await prisma.searchIndexGeneration.deleteMany({ where: { packId } }).catch(() => undefined);
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
  const results: CaseResult[] = [];
  const suffix = randomUUID().slice(0, 8);
  const admin = await ensureBrowserAdminUser(suffix);

  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error("playwright not installed");
    process.exitCode = 1;
    await admin.cleanup();
    return;
  }

  const seeded = await seedPublishedPack(suffix);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const health = await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    if (!health || health.status() >= 500) throw new Error(`App not healthy at ${baseUrl}`);

    // Establish admin session via API (same cookie jar as browser)
    const loginRes = await context.request.post(`${baseUrl}/api/v1/auth/login`, {
      data: { email: admin.email, displayName: "P91 Admin", mode: "login" },
    });
    if (!loginRes.ok()) {
      throw new Error(`Login API failed: ${loginRes.status()} ${(await loginRes.text()).slice(0, 200)}`);
    }
    const sessionRes = await context.request.get(`${baseUrl}/api/v1/auth/session`);
    const sessionJson = (await sessionRes.json()) as {
      loggedIn?: boolean;
      user?: { accountRole?: string };
    };
    if (!sessionJson.loggedIn || sessionJson.user?.accountRole !== "ADMIN") {
      throw new Error(`Admin session not established: ${JSON.stringify(sessionJson)}`);
    }

    // Open login landing / admin review UI with the session cookies
    await page.goto(`${baseUrl}/admin/reviews/${encodeURIComponent(seeded.packId)}?step=publish`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(1500);
    const pageHasUnpublish = (await page.getByText("게시 중단").count()) > 0;

    const unpublishApi = await context.request.post(
      `${baseUrl}/api/v1/admin/reviews/${encodeURIComponent(seeded.packId)}/unpublish`,
      { data: { memo: "browser e2e unpublish A" } },
    );
    const unpublishOk = unpublishApi.ok();
    const blocked = await loadPublicRetrievalPack(seeded.packId);

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const pageHasRestore = (await page.getByText("기존 게시본 다시 게시").count()) > 0;

    const restoreApi = await context.request.post(
      `${baseUrl}/api/v1/admin/reviews/${encodeURIComponent(seeded.packId)}/restore-publish`,
      { data: { memo: "browser e2e restore A" } },
    );
    const restoreBody = (await restoreApi.json()) as {
      restoredGenerationId?: string;
      status?: string;
      error?: string;
      code?: string;
    };
    const scopeA = await resolvePublicRetrievalGenerationScope(seeded.versionId);
    const caseAOk =
      unpublishOk &&
      blocked === null &&
      restoreApi.ok() &&
      restoreBody.restoredGenerationId === seeded.productionId &&
      scopeA.searchIndexGenerationId === seeded.productionId;

    results.push({
      caseId: "A",
      result: caseAOk ? "PASS" : "FAIL",
      detail: caseAOk
        ? "Browser admin session: unpublish→restore Existing served A"
        : "Case A failed",
      evidence: {
        pageHasUnpublish,
        pageHasRestore,
        unpublishStatus: unpublishApi.status(),
        restoreStatus: restoreApi.status(),
        restoredGenerationId: restoreBody.restoredGenerationId ?? null,
        served: scopeA.searchIndexGenerationId,
        preserved: seeded.productionId,
      },
    });

    // ---- Case B ----
    await context.request.post(
      `${baseUrl}/api/v1/admin/reviews/${encodeURIComponent(seeded.packId)}/unpublish`,
      { data: { memo: "browser e2e unpublish B" } },
    );
    const draftB = await prisma.searchIndexGeneration.create({
      data: {
        id: `p91br-gen-${suffix}-b`,
        packId: seeded.packId,
        versionId: seeded.versionId,
        pipelineRunId: seeded.pipelineId,
        normalizedDocumentId: seeded.normalizedId,
        chunkGenerationId: `p91br-cg-${suffix}-b`,
        fingerprint: `p91br-gfp-${suffix}-b`,
        embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
        embeddingModel: DEFAULT_E5_MODEL_ID,
        embeddingModelRevision: SHA,
        embeddingDimension: DEFAULT_E5_EMBEDDING_DIMENSION,
        distanceMetric: "cosine",
        status: "READY",
        scope: "DRAFT",
        generationFingerprint: `p91br-gf-${suffix}-b`,
        chunkCount: 1,
        embeddedCount: 1,
      },
    });
    await prisma.pipelineRun.create({
      data: {
        packId: seeded.packId,
        triggerType: STORE_SERVICE_VALIDATION_TRIGGER,
        status: "PASS",
        summary: "sv-b",
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

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const pageHasNewRev = (await page.getByText("새 Revision 게시").count()) > 0;
    const blockedRestore = await context.request.post(
      `${baseUrl}/api/v1/admin/reviews/${encodeURIComponent(seeded.packId)}/restore-publish`,
      { data: { memo: "should block" } },
    );
    const blockedJson = (await blockedRestore.json()) as { code?: string };
    const publishNew = await context.request.post(
      `${baseUrl}/api/v1/admin/reviews/${encodeURIComponent(seeded.packId)}/publish-new-revision`,
      { data: { memo: "browser e2e publish B" } },
    );
    const publishJson = (await publishNew.json()) as {
      reviewedGenerationId?: string;
      publishedGenerationId?: string;
      servedGenerationId?: string;
    };
    const scopeB = await resolvePublicRetrievalGenerationScope(seeded.versionId);
    const retiredA = await prisma.searchIndexGeneration.findUnique({
      where: { id: seeded.productionId },
      select: { status: true },
    });
    const caseBOk =
      blockedJson.code === "NEW_REVISION_PENDING" &&
      publishNew.ok() &&
      publishJson.reviewedGenerationId === draftB.id &&
      publishJson.publishedGenerationId === draftB.id &&
      scopeB.searchIndexGenerationId === draftB.id &&
      retiredA?.status === "RETIRED";

    results.push({
      caseId: "B",
      result: caseBOk ? "PASS" : "FAIL",
      detail: caseBOk
        ? "Browser admin session: Draft B blocked restore; new revision served B"
        : "Case B failed",
      evidence: {
        pageHasNewRev,
        blockedCode: blockedJson.code ?? null,
        reviewed: publishJson.reviewedGenerationId ?? null,
        served: scopeB.searchIndexGenerationId,
        aStatus: retiredA?.status ?? null,
      },
    });

    // ---- Case C ----
    const cSuffix = `${suffix}c`;
    const cPack = await seedPublishedPack(cSuffix);
    await prisma.searchIndexGeneration.create({
      data: {
        id: `p91br-gen-${cSuffix}-draft`,
        packId: cPack.packId,
        versionId: cPack.versionId,
        pipelineRunId: cPack.pipelineId,
        normalizedDocumentId: cPack.normalizedId,
        chunkGenerationId: `p91br-cg-${cSuffix}-draft`,
        fingerprint: `p91br-gfp-${cSuffix}-draft`,
        embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
        embeddingModel: DEFAULT_E5_MODEL_ID,
        embeddingModelRevision: SHA,
        embeddingDimension: DEFAULT_E5_EMBEDDING_DIMENSION,
        distanceMetric: "cosine",
        status: "READY",
        scope: "DRAFT",
        generationFingerprint: `p91br-gf-${cSuffix}-draft`,
        chunkCount: 1,
        embeddedCount: 1,
      },
    });
    const publicPack = await loadPublicRetrievalPack(cPack.packId);
    const publicScope = publicPack
      ? await resolvePublicRetrievalGenerationScope(publicPack.versionId)
      : null;
    const pubPage = await page.goto(`${baseUrl}/packs/${encodeURIComponent(cPack.packId)}`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    const caseCOk =
      publicPack !== null &&
      publicScope?.searchIndexGenerationId === cPack.productionId &&
      Boolean(pubPage?.ok());
    results.push({
      caseId: "C",
      result: caseCOk ? "PASS" : "FAIL",
      detail: caseCOk
        ? "Public page + retrieval serve PRODUCTION only while Draft READY exists"
        : "Case C draft leakage or public failure",
      evidence: {
        productionId: cPack.productionId,
        served: publicScope?.searchIndexGenerationId ?? null,
        pageStatus: pubPage?.status() ?? null,
      },
    });
    await cPack.cleanup();
  } catch (error) {
    results.push({
      caseId: "A",
      result: "FAIL",
      detail: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  } finally {
    await browser.close();
    await seeded.cleanup().catch(() => undefined);
    await admin.cleanup().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
    const report = {
      baseUrl,
      mode: "playwright-browser-session+admin-api+public-ui",
      results,
      wroteAt: new Date().toISOString(),
      passCount: results.filter((r) => r.result === "PASS").length,
      failCount: results.filter((r) => r.result !== "PASS").length,
    };
    writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (report.failCount > 0) process.exitCode = 1;
  }
}

main().catch(async (e) => {
  console.error(e);
  process.exitCode = 1;
  await prisma.$disconnect().catch(() => undefined);
});
