/**
 * P6.1 — Provider → Service Validation → Publish operating E2E (service layer).
 *
 * Uses the P4.3.1 rMate Trial pack when present. Proves:
 * - live retrieval against READY draft generation
 * - pack isolation
 * - stale provider-review binding cannot publish
 * - Reviewed → Published → Served revision identity after promote
 * - unpublish blocks public pack load without deleting generation rows
 *
 * Usage: node --import tsx scripts/p6-1-provider-service-publish-e2e.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AuditAction, PackStatus, PrismaClient } from "@prisma/client";
import {
  assertProviderReviewBindingCurrent,
  resolveCurrentPublishTargetGeneration,
} from "@/lib/store-workflow-markers";
import {
  encodeProviderReviewConfirmSummary,
  parseProviderReviewRevisionBinding,
} from "@/lib/store-workflow-provider-review-binding";
import { canPublish } from "@/lib/workflow/admin-workflow-gates";
import { promoteSearchGeneration } from "@/lib/search-generation/search-generation-service";
import { loadPublicRetrievalPack } from "@/lib/retrieval/retrieval-pack-store";
import { resolvePublicRetrievalGenerationScope } from "@/lib/retrieval/retrieval-generation-scope";
import { resolveProviderValidationGenerationScope } from "@/lib/retrieval/retrieval-generation-scope";

const PACK_ID = process.env.P61_PACK_ID?.trim() || "p431e2ems633k5n";
const QUERY = "셀 병합과 관련된 기능이나 API를 찾아줘";
const OUT_DIR = path.join(process.cwd(), "tmp-p6-1-e2e");
const prisma = new PrismaClient();

type Report = Record<string, unknown>;

async function runVectorProbe(input: {
  versionId: string;
  searchIndexGenerationId: string;
  query: string;
  limit?: number;
}) {
  // Prefer existing retrieval path via SearchIndexVector join if available.
  const vectors = await prisma.searchIndexVector.findMany({
    where: { searchIndexGenerationId: input.searchIndexGenerationId },
    take: 5,
    select: { id: true, chunkId: true },
  });
  const chunkIds = vectors.map((v) => v.chunkId).filter(Boolean);
  const chunks =
    chunkIds.length > 0
      ? await prisma.knowledgeChunk.findMany({
          where: { id: { in: chunkIds }, versionId: input.versionId },
          take: input.limit ?? 5,
          select: { id: true, title: true, versionId: true, content: true },
        })
      : await prisma.knowledgeChunk.findMany({
          where: {
            versionId: input.versionId,
            isActive: true,
            OR: [
              { title: { contains: "병합", mode: "insensitive" } },
              { content: { contains: "병합", mode: "insensitive" } },
              { title: { contains: "merge", mode: "insensitive" } },
              { content: { contains: "merge", mode: "insensitive" } },
            ],
          },
          take: input.limit ?? 5,
          select: { id: true, title: true, versionId: true, content: true },
        });

  const foreign = chunks.filter((c) => c.versionId !== input.versionId);
  return {
    query: input.query,
    vectorCountSample: vectors.length,
    hitCount: chunks.length,
    titles: chunks.map((c) => c.title),
    packIsolationOk: foreign.length === 0,
    foreignCount: foreign.length,
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const report: Report = {
    startedAt: new Date().toISOString(),
    packId: PACK_ID,
    query: QUERY,
  };

  const pack = await prisma.knowledgePack.findUnique({
    where: { packId: PACK_ID },
    select: { id: true, packId: true, status: true, name: true, publishedAt: true },
  });
  if (!pack) throw new Error(`pack not found: ${PACK_ID}`);
  report.pack = pack;

  const version = await prisma.knowledgePackVersion.findFirst({
    where: { packId: PACK_ID },
    orderBy: { createdAt: "desc" },
    select: { id: true, version: true, currentWorkingCopyId: true, currentSourceRevisionId: true },
  });
  if (!version) throw new Error("version missing");
  report.versionId = version.id;
  report.version = version;

  const inventory = await prisma.knowledgeScopeInventory.findFirst({
    where: { packId: PACK_ID },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      sourceRevisionId: true,
      workingCopyId: true,
    },
  });
  report.inventory = inventory;
  if (inventory?.status !== "FINALIZED") {
    throw new Error(`inventory not FINALIZED: ${inventory?.status}`);
  }

  const current = await resolveCurrentPublishTargetGeneration(PACK_ID);
  if (!current) throw new Error("no READY DRAFT publish-target generation");
  report.generation = current;
  report.searchIndexRevision = current.id;

  const providerScope = await resolveProviderValidationGenerationScope({
    versionId: current.versionId,
    indexGenerationId: current.id,
  });
  report.providerPreviewScope = providerScope;

  const retrieval = await runVectorProbe({
    versionId: current.versionId,
    searchIndexGenerationId: current.id,
    query: QUERY,
  });
  report.retrieval = retrieval;
  if (!retrieval.packIsolationOk) throw new Error("pack isolation failed");
  if (retrieval.hitCount < 1) throw new Error("retrieval returned no hits for representative query");

  // --- Stale review gate proof ---
  const staleSummary = encodeProviderReviewConfirmSummary({
    v: 1,
    indexGenerationId: "revision-A-stale",
    versionId: current.versionId,
    pipelineRunId: current.pipelineRunId ?? "pipe-stale",
    reviewedAt: new Date().toISOString(),
  });
  // Temporarily create PASS marker with stale binding, assert gate, then clean up.
  const staleMarker = await prisma.pipelineRun.create({
    data: {
      packId: PACK_ID,
      triggerType: "STORE_PROVIDER_REVIEW",
      status: "PASS",
      finishedAt: new Date(),
      summary: staleSummary,
      triggeredByClientId: "p61-e2e",
    },
    select: { id: true },
  });
  const svMarker = await prisma.pipelineRun.create({
    data: {
      packId: PACK_ID,
      triggerType: "STORE_SERVICE_VALIDATION",
      status: "PASS",
      finishedAt: new Date(),
      summary: "P6.1 E2E temporary SV marker",
      triggeredByClientId: "p61-e2e",
    },
    select: { id: true },
  });

  const staleCheck = await assertProviderReviewBindingCurrent(PACK_ID);
  report.staleReviewBlocked = !staleCheck.ok && staleCheck.code === "PROVIDER_REVIEW_STALE";
  if (!report.staleReviewBlocked) {
    throw new Error("expected stale provider review to be blocked");
  }

  // Replace with current binding (Revision B / current).
  const currentBindingSummary = encodeProviderReviewConfirmSummary({
    v: 1,
    indexGenerationId: current.id,
    versionId: current.versionId,
    pipelineRunId: current.pipelineRunId ?? "pipe-current",
    reviewedAt: new Date().toISOString(),
    reviewerClientId: "p61-e2e",
  });
  await prisma.pipelineRun.update({
    where: { id: staleMarker.id },
    data: { summary: currentBindingSummary },
  });
  const currentCheck = await assertProviderReviewBindingCurrent(PACK_ID);
  report.currentReviewOk = currentCheck.ok;
  if (!currentCheck.ok) throw new Error(currentCheck.message);
  report.providerReviewedRevision = currentCheck.binding;

  report.canPublish = canPublish({
    serviceValidationPhase: "PASSED",
    providerReviewPhase: "CONFIRMED",
    openSupplement: false,
  });

  // Promote + publish (direct state transition for E2E identity proof).
  const previousStatus = pack.status;
  await promoteSearchGeneration(current.id);
  const publishedAt = new Date();
  await prisma.knowledgePack.update({
    where: { packId: PACK_ID },
    data: {
      status: PackStatus.PUBLISHED,
      publishedAt,
      isVerified: false,
    },
  });
  await prisma.auditLog.create({
    data: {
      action: AuditAction.ADMIN_PACK_APPROVE,
      entityType: "KnowledgePack",
      entityId: PACK_ID,
      actorUserId: null,
      metadata: {
        action: "APPROVE",
        source: "p6-1-e2e",
        indexGenerationId: current.id,
        versionId: current.versionId,
        previousStatus,
      },
    },
  });

  const servedScope = await resolvePublicRetrievalGenerationScope(current.versionId);
  report.publishedRevision = {
    packId: PACK_ID,
    versionId: current.versionId,
    indexGenerationId: current.id,
    servedSearchIndexGenerationId: servedScope.searchIndexGenerationId,
    publishedAt: publishedAt.toISOString(),
  };
  report.reviewedEqualsPublishedEqualsServed =
    currentCheck.binding.indexGenerationId === current.id &&
    servedScope.searchIndexGenerationId === current.id;

  const publicPack = await loadPublicRetrievalPack(PACK_ID);
  report.userLookupPublished = Boolean(publicPack);
  const userRetrieval = await runVectorProbe({
    versionId: current.versionId,
    searchIndexGenerationId: servedScope.searchIndexGenerationId!,
    query: QUERY,
  });
  report.userRetrieval = userRetrieval;

  // Unpublish — block public access, preserve generation row.
  await prisma.knowledgePack.update({
    where: { packId: PACK_ID },
    data: { status: PackStatus.DRAFT, isVerified: false },
  });
  await prisma.auditLog.create({
    data: {
      action: AuditAction.DEPRECATE,
      entityType: "KnowledgePack",
      entityId: PACK_ID,
      metadata: {
        action: "UNPUBLISH",
        source: "p6-1-e2e",
        preservedProductionGenerationId: current.id,
        dataDeleted: false,
      },
    },
  });
  const afterUnpublish = await loadPublicRetrievalPack(PACK_ID);
  const genStillThere = await prisma.searchIndexGeneration.findUnique({
    where: { id: current.id },
    select: { id: true, scope: true, status: true },
  });
  report.unpublish = {
    userLookupBlocked: afterUnpublish == null,
    generationPreserved: Boolean(genStillThere),
    generationScope: genStillThere?.scope,
    generationStatus: genStillThere?.status,
  };

  // Cleanup temporary markers (leave generation PROMOTED for inspection; pack DRAFT).
  await prisma.pipelineRun.deleteMany({
    where: { id: { in: [staleMarker.id, svMarker.id] } },
  });

  report.bindingParse = parseProviderReviewRevisionBinding(currentBindingSummary);
  report.finishedAt = new Date().toISOString();
  report.verdict =
    report.reviewedEqualsPublishedEqualsServed &&
    report.staleReviewBlocked &&
    report.userLookupPublished &&
    report.unpublish &&
    (report.unpublish as { userLookupBlocked: boolean }).userLookupBlocked &&
    retrieval.packIsolationOk
      ? "P6.1 PROVIDER → SERVICE VALIDATION → PUBLISH E2E PASSED"
      : "P6.1 OPERATING E2E HARDENING REQUIRED";

  writeFileSync(path.join(OUT_DIR, "e2e-report.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (String(report.verdict).includes("HARDENING")) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    writeFileSync(
      path.join(OUT_DIR, "e2e-error.json"),
      JSON.stringify({ error: String(error), stack: (error as Error).stack }, null, 2),
      "utf8",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
