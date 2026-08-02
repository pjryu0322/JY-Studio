/**
 * PackWorkflowFactsLoader — batch-safe DB → typed PackWorkflowFacts.
 * Snapshot resolvers stay pure; UI must not call Prisma.
 */
import { AuditAction, PackStatus, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isOpenProviderSupplementPhase } from "@/lib/provider-supplement-request";
import {
  WORKER_ZIP_REQUEST_ACCEPTED_STATUS,
  WORKER_ZIP_REQUEST_TRIGGER,
} from "@/lib/python-worker/worker-zip-import-provider-service";
import { batchResolveStoreWorkflowMarkers } from "@/lib/store-workflow-markers";
import type { PackWorkflowFacts } from "@/lib/workflow/pack-workflow-facts";
import {
  normalizePackReviewStatus,
  normalizePackStatus,
  normalizeProviderReviewPhase,
  normalizeServiceValidationPhase,
  normalizeWorkerZipPhase,
} from "@/lib/workflow/pack-workflow-facts-normalize";
import {
  resolvePublishRecoveryMode,
  type PublishRecoveryMode,
} from "@/lib/workflow/publish-recovery";

type PrismaLike = Pick<
  PrismaClient,
  | "knowledgePack"
  | "pipelineRun"
  | "knowledgeScopeInventory"
  | "correctionCase"
  | "releaseGateRun"
  | "searchIndexGeneration"
  | "packReview"
  | "auditLog"
>;

const WORKER_ZIP_IMPORT_TRIGGER = "WORKER_ZIP_IMPORT";

export async function loadPackWorkflowFacts(
  packId: string,
  client: PrismaLike = prisma,
): Promise<PackWorkflowFacts | null> {
  const map = await batchLoadPackWorkflowFacts([packId], client);
  return map.get(packId) ?? null;
}

/**
 * Batch-load typed facts for many packs (no per-pack N+1 loops).
 *
 * Query structure (O(1) round-trips vs pack count):
 * - knowledgePack.findMany
 * - pipelineRun.findMany (ZIP request + IMPORT)
 * - knowledgeScopeInventory.findMany
 * - correctionCase.groupBy
 * - releaseGateRun.findMany
 * - searchIndexGeneration.findMany (draft + production)
 * - packReview.findMany
 * - auditLog.findMany (unpublish snapshots)
 * - batchResolveStoreWorkflowMarkers (3 findMany)
 */
export async function batchLoadPackWorkflowFacts(
  packIds: readonly string[],
  client: PrismaLike = prisma,
): Promise<Map<string, PackWorkflowFacts>> {
  const unique = [...new Set(packIds.map((id) => id.trim()).filter(Boolean))];
  const out = new Map<string, PackWorkflowFacts>();
  if (unique.length === 0) return out;

  const [
    packs,
    zipRuns,
    inventories,
    openCorrections,
    severityGroups,
    releaseGates,
    draftGens,
    productionGens,
    reviews,
    unpublishAudits,
    markersByPack,
  ] = await Promise.all([
    client.knowledgePack.findMany({
      where: { packId: { in: unique } },
      select: { packId: true, status: true },
    }),
    client.pipelineRun.findMany({
      where: {
        packId: { in: unique },
        triggerType: {
          in: [WORKER_ZIP_REQUEST_TRIGGER, WORKER_ZIP_IMPORT_TRIGGER],
        },
        status: {
          in: ["PENDING", WORKER_ZIP_REQUEST_ACCEPTED_STATUS, "PASS", "RUNNING"],
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        packId: true,
        triggerType: true,
        status: true,
        sourceRevisionId: true,
        workingCopyId: true,
        createdAt: true,
      },
    }),
    client.knowledgeScopeInventory.findMany({
      where: { packId: { in: unique } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        packId: true,
        status: true,
        includedCount: true,
        pendingCount: true,
        sourceRevisionId: true,
        workingCopyId: true,
        updatedAt: true,
      },
    }),
    client.correctionCase.groupBy({
      by: ["packId"],
      where: { packId: { in: unique }, status: "OPEN" },
      _count: { _all: true },
    }),
    client.correctionCase.groupBy({
      by: ["packId", "severity"],
      where: {
        packId: { in: unique },
        status: "OPEN",
        severity: { in: ["BLOCKER", "WARNING"] },
      },
      _count: { _all: true },
    }),
    client.releaseGateRun.findMany({
      where: { packId: { in: unique } },
      orderBy: { checkedAt: "desc" },
      select: { packId: true, status: true, checkedAt: true },
    }),
    client.searchIndexGeneration.findMany({
      where: {
        packId: { in: unique },
        status: "READY",
        scope: "DRAFT",
        staleAt: null,
        retiredAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, packId: true, createdAt: true },
    }),
    client.searchIndexGeneration.findMany({
      where: {
        packId: { in: unique },
        status: "PROMOTED",
        scope: "PRODUCTION",
        staleAt: null,
        retiredAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, packId: true },
    }),
    client.packReview.findMany({
      where: { packId: { in: unique } },
      orderBy: { createdAt: "desc" },
      select: { packId: true, status: true },
    }),
    client.auditLog.findMany({
      where: {
        entityType: "KnowledgePack",
        entityId: { in: unique },
        action: AuditAction.DEPRECATE,
      },
      orderBy: { createdAt: "desc" },
      select: { entityId: true, metadata: true, createdAt: true },
    }),
    batchResolveStoreWorkflowMarkers(unique, client as never),
  ]);

  const packStatusById = new Map(packs.map((p) => [p.packId, p.status]));

  type ZipPhase = "REQUESTED" | "ACCEPTED" | "COMPLETED";
  const zipPhaseByPack = new Map<
    string,
    {
      phase: ZipPhase;
      sourceRevisionId: string | null;
      workingCopyId: string | null;
    }
  >();
  for (const run of zipRuns) {
    if (zipPhaseByPack.has(run.packId)) continue;
    if (run.triggerType === WORKER_ZIP_IMPORT_TRIGGER && run.status === "PASS") {
      zipPhaseByPack.set(run.packId, {
        phase: "COMPLETED",
        sourceRevisionId: run.sourceRevisionId ?? null,
        workingCopyId: run.workingCopyId ?? null,
      });
      continue;
    }
    if (run.triggerType === WORKER_ZIP_REQUEST_TRIGGER) {
      const phase: ZipPhase =
        run.status === "PASS"
          ? "COMPLETED"
          : run.status === WORKER_ZIP_REQUEST_ACCEPTED_STATUS
            ? "ACCEPTED"
            : "REQUESTED";
      zipPhaseByPack.set(run.packId, {
        phase,
        sourceRevisionId: run.sourceRevisionId ?? null,
        workingCopyId: run.workingCopyId ?? null,
      });
    }
  }

  const inventoryByPack = new Map<
    (typeof inventories)[number]["packId"],
    (typeof inventories)[number]
  >();
  for (const row of inventories) {
    const existing = inventoryByPack.get(row.packId);
    if (!existing) {
      inventoryByPack.set(row.packId, row);
      continue;
    }
    if (existing.status === "DRAFT") continue;
    if (row.status === "DRAFT") inventoryByPack.set(row.packId, row);
  }

  const openCountByPack = new Map(
    openCorrections.map((r) => [r.packId, r._count._all]),
  );
  const blockerCountByPack = new Map<string, number>();
  const warningCountByPack = new Map<string, number>();
  for (const row of severityGroups) {
    if (row.severity === "BLOCKER") {
      blockerCountByPack.set(row.packId, row._count._all);
    } else if (row.severity === "WARNING") {
      warningCountByPack.set(row.packId, row._count._all);
    }
  }

  const gateByPack = new Map<string, { status: string }>();
  for (const gate of releaseGates) {
    if (!gateByPack.has(gate.packId)) {
      gateByPack.set(gate.packId, { status: gate.status });
    }
  }

  const draftGenByPack = new Map<string, string>();
  for (const gen of draftGens) {
    if (!draftGenByPack.has(gen.packId)) draftGenByPack.set(gen.packId, gen.id);
  }
  const productionGenByPack = new Map<string, string>();
  for (const gen of productionGens) {
    if (!productionGenByPack.has(gen.packId)) {
      productionGenByPack.set(gen.packId, gen.id);
    }
  }

  const reviewByPack = new Map<string, string>();
  for (const review of reviews) {
    if (!reviewByPack.has(review.packId)) {
      reviewByPack.set(review.packId, review.status);
    }
  }

  const unpublishByPack = new Map<
    string,
    { preservedGenerationId: string | null }
  >();
  for (const row of unpublishAudits) {
    const packId = row.entityId;
    if (unpublishByPack.has(packId)) continue;
    const meta = row.metadata as Record<string, unknown> | null;
    if (!meta || meta.action !== "UNPUBLISH") continue;
    const preserved =
      typeof meta.preservedProductionGenerationId === "string"
        ? meta.preservedProductionGenerationId
        : typeof meta.generationId === "string"
          ? meta.generationId
          : null;
    unpublishByPack.set(packId, { preservedGenerationId: preserved });
  }

  for (const packId of unique) {
    const packStatus = normalizePackStatus(
      packStatusById.get(packId) ?? PackStatus.DRAFT,
    );
    const zip = zipPhaseByPack.get(packId);
    const inventory = inventoryByPack.get(packId);
    const markers = markersByPack.get(packId);
    const providerPhase = normalizeProviderReviewPhase(
      markers?.providerReviewPhase ?? "NONE",
    );
    const servicePhase = normalizeServiceValidationPhase(
      markers?.serviceValidationPhase ?? "NONE",
    );
    const openSupplement = isOpenProviderSupplementPhase(
      markers?.providerSupplementPhase ?? "NONE",
    );
    const gate = gateByPack.get(packId);
    const qualityFail = gate?.status === "FAIL" ? 1 : 0;
    const qualityCompleted =
      gate?.status === "PASS" ||
      gate?.status === "WARNING" ||
      gate?.status === "FAIL";
    const workerZipPhase = normalizeWorkerZipPhase(zip?.phase ?? "NONE");
    const openCount = openCountByPack.get(packId) ?? 0;
    const draftGenId = draftGenByPack.get(packId) ?? null;
    const productionGenId = productionGenByPack.get(packId) ?? null;
    const unpublish = unpublishByPack.get(packId);
    const preservedGenerationId = unpublish?.preservedGenerationId ?? null;

    let recoveryMode: PublishRecoveryMode | null = null;
    if (packStatus === PackStatus.DRAFT && (unpublish || draftGenId)) {
      recoveryMode = resolvePublishRecoveryMode({
        packStatus,
        hasUnpublishSnapshot: Boolean(unpublish),
        preservedProductionValid: Boolean(preservedGenerationId),
        materialChangeAfterUnpublish: Boolean(draftGenId),
        hasCurrentDraftReady: Boolean(draftGenId),
        openSupplement,
        openCorrection: openCount > 0,
      });
    }

    out.set(packId, {
      packId,
      packStatus,
      receipt: {
        accepted:
          workerZipPhase === "ACCEPTED" ||
          workerZipPhase === "COMPLETED" ||
          workerZipPhase === "PROCESSING",
        workerZipPhase,
        sourceRevisionId:
          inventory?.sourceRevisionId ?? zip?.sourceRevisionId ?? null,
        workingCopyId: inventory?.workingCopyId ?? zip?.workingCopyId ?? null,
      },
      knowledgeScope: {
        inventoryId: inventory?.id ?? null,
        finalized: inventory?.status === "FINALIZED",
        includedCount: inventory?.includedCount ?? 0,
        pendingCount: inventory?.pendingCount ?? 0,
      },
      generation: {
        generationId: draftGenId ?? productionGenId,
        completed: workerZipPhase === "COMPLETED" && Boolean(qualityCompleted),
        blockerCount: blockerCountByPack.get(packId) ?? 0,
        warningCount: warningCountByPack.get(packId) ?? 0,
        failCount: qualityFail,
      },
      correction: {
        openCount,
        openSupplement,
      },
      serviceValidation: {
        phase: servicePhase,
        generationId: draftGenId,
      },
      providerReview: {
        phase: providerPhase,
        generationId: draftGenId,
        confirmed: providerPhase === "CONFIRMED",
      },
      publishing: {
        productionGenerationId: productionGenId,
        preservedGenerationId,
        packReviewStatus: normalizePackReviewStatus(
          reviewByPack.get(packId) ?? null,
        ),
        recoveryMode,
      },
    });
  }

  return out;
}
