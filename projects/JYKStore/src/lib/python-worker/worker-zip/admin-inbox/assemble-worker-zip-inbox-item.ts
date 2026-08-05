import { PackStatus } from "@prisma/client";
import { buildAdminWorkInboxItemViewModel } from "@/lib/admin-work-inbox-view-model";
import type { prisma } from "@/lib/prisma";
import type { ProviderSupplementAdminPhase } from "@/lib/provider-supplement-request";
import type { getWorkerZipRequestMetadata } from "@/lib/python-worker/worker-zip-request-storage";
import { applyLegacyRequestTimestamps, deriveAcceptedAt, derivePhaseFromRunStatus } from "./request-status-mapper";
import type {
  AdminWorkerZipDraftItem,
  AdminWorkerZipRequestListItem,
  LegacyWorkerZipRequestRow,
  WorkerZipCompletedImportRunRow,
  WorkerZipRequestRunRow,
} from "./types";

type PrismaClient = typeof prisma;
type GetRequestMetadata = typeof getWorkerZipRequestMetadata;

async function resolveOriginalFileName(input: {
  packId: string;
  versionId: string | undefined;
  env?: NodeJS.ProcessEnv;
  getRequestMetadata: GetRequestMetadata;
}): Promise<string | null> {
  if (!input.versionId) return null;
  const meta = await input
    .getRequestMetadata({
      packId: input.packId,
      packVersionId: input.versionId,
      env: input.env,
    })
    .catch(() => null);
  return meta?.originalFileName ?? null;
}

/**
 * Dedupe open request runs by pack (newest first) and build draft inbox rows.
 * Metadata fetches run in parallel to avoid a sequential per-pack await loop.
 */
export async function buildDraftItemsFromOpenRuns(input: {
  runs: WorkerZipRequestRunRow[];
  env?: NodeJS.ProcessEnv;
  getRequestMetadata: GetRequestMetadata;
}): Promise<{ draftItems: AdminWorkerZipDraftItem[]; seen: Set<string> }> {
  const seen = new Set<string>();
  const unique: WorkerZipRequestRunRow[] = [];
  for (const run of input.runs) {
    if (seen.has(run.packId)) continue;
    seen.add(run.packId);
    unique.push(run);
  }

  const fileNames = await Promise.all(
    unique.map((run) =>
      resolveOriginalFileName({
        packId: run.packId,
        versionId: run.pack?.versions?.[0]?.id,
        env: input.env,
        getRequestMetadata: input.getRequestMetadata,
      }),
    ),
  );

  const draftItems: AdminWorkerZipDraftItem[] = unique.map((run, i) => {
    const version = run.pack?.versions?.[0] ?? null;
    const phase = derivePhaseFromRunStatus(run.status);
    return {
      packId: run.packId,
      packName: run.pack?.name ?? run.packId,
      providerName: run.pack?.providerProfile?.displayName ?? null,
      categoryId: run.pack?.categoryId ?? null,
      categoryName: run.pack?.category?.name ?? null,
      versionLabel: version?.version ?? null,
      requestedAt: run.createdAt.toISOString(),
      acceptedAt: deriveAcceptedAt({
        phase,
        createdAt: run.createdAt,
        startedAt: run.startedAt ?? null,
        updatedAt: run.updatedAt ?? null,
      }),
      originalFileName: fileNames[i] ?? null,
      accepted: phase === "ACCEPTED" || phase === "COMPLETED",
      phase,
      packStatus: run.pack?.status ?? PackStatus.DRAFT,
    };
  });

  return { draftItems, seen };
}

/**
 * Recover DRAFT packs whose request markers were retired after a successful
 * WORKER_ZIP_IMPORT PASS, then optionally backfill timestamps from legacy markers.
 */
export async function appendRecoveredCompletedImportItems(input: {
  draftItems: AdminWorkerZipDraftItem[];
  seen: Set<string>;
  completedImports: WorkerZipCompletedImportRunRow[];
  legacyRequests: LegacyWorkerZipRequestRow[];
  env?: NodeJS.ProcessEnv;
  getRequestMetadata: GetRequestMetadata;
}): Promise<string[]> {
  const recoveredPackIds: string[] = [];
  const toAppend: WorkerZipCompletedImportRunRow[] = [];
  for (const run of input.completedImports) {
    if (input.seen.has(run.packId)) continue;
    input.seen.add(run.packId);
    recoveredPackIds.push(run.packId);
    toAppend.push(run);
  }

  const fileNames = await Promise.all(
    toAppend.map((run) =>
      resolveOriginalFileName({
        packId: run.packId,
        versionId: run.pack?.versions?.[0]?.id,
        env: input.env,
        getRequestMetadata: input.getRequestMetadata,
      }),
    ),
  );

  for (let i = 0; i < toAppend.length; i++) {
    const run = toAppend[i]!;
    const version = run.pack?.versions?.[0] ?? null;
    input.draftItems.push({
      packId: run.packId,
      packName: run.pack?.name ?? run.packId,
      providerName: run.pack?.providerProfile?.displayName ?? null,
      categoryId: run.pack?.categoryId ?? null,
      categoryName: run.pack?.category?.name ?? null,
      versionLabel: version?.version ?? null,
      requestedAt: run.createdAt.toISOString(),
      acceptedAt: (run.startedAt ?? run.createdAt).toISOString(),
      originalFileName: fileNames[i] ?? null,
      accepted: true,
      phase: "COMPLETED",
      packStatus: run.pack?.status ?? PackStatus.DRAFT,
    });
  }

  if (recoveredPackIds.length > 0) {
    applyLegacyRequestTimestamps(input.draftItems, input.legacyRequests);
  }

  return recoveredPackIds;
}

export async function loadQualityStatusMaps(
  client: PrismaClient,
  packIds: string[],
): Promise<{
  qualityCheckedAtByPack: Map<string, string | null>;
  qualityStatusByPack: Map<string, string>;
}> {
  const [
    releaseGateRuns,
    sourceValidationReports,
    structureCoverageReports,
    knowledgeQualityReports,
    chunkQualityReports,
    retrievalEvaluationRuns,
  ] = await Promise.all([
    client.releaseGateRun?.findMany?.({
      where: { packId: { in: packIds } },
      orderBy: { checkedAt: "desc" },
      select: { packId: true, checkedAt: true, status: true },
    }) ?? [],
    client.sourceValidationReport?.findMany?.({
      where: { packId: { in: packIds } },
      select: { packId: true, checkedAt: true },
    }) ?? [],
    client.structureCoverageReport?.findMany?.({
      where: { packId: { in: packIds } },
      select: { packId: true, checkedAt: true },
    }) ?? [],
    client.knowledgeQualityReport?.findMany?.({
      where: { packId: { in: packIds } },
      select: { packId: true, checkedAt: true },
    }) ?? [],
    client.chunkQualityReport?.findMany?.({
      where: { packId: { in: packIds } },
      select: { packId: true, checkedAt: true },
    }) ?? [],
    client.retrievalEvaluationRun?.findMany?.({
      where: { packId: { in: packIds } },
      select: { packId: true, checkedAt: true },
    }) ?? [],
  ]);

  const latestReleaseGateByPack = new Map<string, { checkedAt: Date; status: string }>();
  for (const run of releaseGateRuns) {
    if (!latestReleaseGateByPack.has(run.packId)) {
      latestReleaseGateByPack.set(run.packId, {
        checkedAt: run.checkedAt,
        status: run.status,
      });
    }
  }

  // Fallback: when ReleaseGateRun isn't created yet (or run aborted early),
  // still infer an "IN_PROGRESS" quality state from any existing report rows.
  const maxCheckedAtMsByPack = new Map<string, number>();
  for (const id of packIds) maxCheckedAtMsByPack.set(id, 0);
  const updateMax = (rows: readonly { packId: string; checkedAt: Date }[]) => {
    for (const r of rows) {
      const ms = r.checkedAt.getTime();
      const prev = maxCheckedAtMsByPack.get(r.packId) ?? 0;
      if (ms > prev) maxCheckedAtMsByPack.set(r.packId, ms);
    }
  };
  updateMax(sourceValidationReports);
  updateMax(structureCoverageReports);
  updateMax(knowledgeQualityReports);
  updateMax(chunkQualityReports);
  updateMax(retrievalEvaluationRuns);

  const qualityCheckedAtByPack = new Map<string, string | null>();
  const qualityStatusByPack = new Map<string, string>();
  for (const id of packIds) {
    const gate = latestReleaseGateByPack.get(id);
    if (gate) {
      qualityCheckedAtByPack.set(id, gate.checkedAt.toISOString());
      qualityStatusByPack.set(id, gate.status);
      continue;
    }
    const ms = maxCheckedAtMsByPack.get(id) ?? 0;
    if (ms > 0) {
      qualityCheckedAtByPack.set(id, new Date(ms).toISOString());
      qualityStatusByPack.set(id, "IN_PROGRESS");
    } else {
      qualityCheckedAtByPack.set(id, null);
      qualityStatusByPack.set(id, "NOT_CHECKED");
    }
  }

  return { qualityCheckedAtByPack, qualityStatusByPack };
}

export function assembleWorkerZipInboxItems(input: {
  draftItems: AdminWorkerZipDraftItem[];
  markersByPack: Map<
    string,
    {
      providerReviewPhase?: "NONE" | "REQUESTED" | "CONFIRMED" | "WITHDRAWN";
      serviceValidationPhase?: "NONE" | "PASSED";
      providerSupplementPhase?: string | null;
    }
  >;
  qualityCheckedAtByPack: Map<string, string | null>;
  qualityStatusByPack: Map<string, string>;
}): AdminWorkerZipRequestListItem[] {
  return input.draftItems.map((item) => {
    const markers = input.markersByPack.get(item.packId);
    const providerReviewPhase = markers?.providerReviewPhase ?? "NONE";
    const serviceValidationPhase = markers?.serviceValidationPhase ?? "NONE";
    const view = buildAdminWorkInboxItemViewModel({
      packId: item.packId,
      packName: item.packName,
      packStatus: item.packStatus,
      sourceKind: "WORKER_ZIP",
      workerZipPhase: item.phase,
      providerReviewPhase,
      providerSupplementPhase:
        (markers?.providerSupplementPhase as ProviderSupplementAdminPhase | "NONE" | null | undefined) ??
        "NONE",
      serviceValidationPhase,
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      providerName: item.providerName,
      versionLabel: item.versionLabel,
      requestedAt: item.requestedAt,
      acceptedAt: item.acceptedAt,
    });
    return {
      ...item,
      providerReviewPhase: view.providerReviewPhase,
      serviceValidationPhase: view.serviceValidationPhase,
      workflowStatus: view.workflowStatus,
      displayStatus: view.displayStatus,
      adminQueueGroup: view.adminQueueGroup,
      ctaLabel: view.ctaLabel,
      isWaitingForAdmin: view.isWaitingForAdmin,
      qualityCheckedAt: input.qualityCheckedAtByPack.get(item.packId) ?? null,
      qualityStatus: input.qualityStatusByPack.get(item.packId) ?? "NOT_CHECKED",
    };
  });
}
