/* ------------------------------------------------------------------ *
 * P7.3: Admin 접수함 — DRAFT packs with a pending generation request.
 * ------------------------------------------------------------------ */
import { PackStatus } from "@prisma/client";
import { buildAdminWorkInboxItemViewModel } from "@/lib/admin-work-inbox-view-model";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import { prisma } from "@/lib/prisma";
import { getWorkerZipRequestMetadata } from "@/lib/python-worker/worker-zip-request-storage";
import { batchResolveStoreWorkflowMarkers } from "@/lib/store-workflow-markers";
import { WORKER_ZIP_REQUEST_ACCEPTED_STATUS, WORKER_ZIP_REQUEST_TRIGGER } from "./constants";

export type AdminWorkerZipRequestListItem = {
  packId: string;
  packName: string;
  providerName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  versionLabel: string | null;
  requestedAt: string;
  /** ISO timestamp when Admin 접수 completed; null while still 접수 대기. */
  acceptedAt: string | null;
  /**
   * 품질점검(품질점검 리프레시) 결과가 마지막으로 확정된 시각 — ISO.
   * 미실행이면 null.
   */
  qualityCheckedAt: string | null;
  /**
   * 품질점검상태: NOT_CHECKED / IN_PROGRESS / PASS / WARNING / FAIL
   * (ReleaseGateRun 기준 — 없으면 다른 품질 리포트 존재 여부로 IN_PROGRESS 추정)
   */
  qualityStatus: string;
  originalFileName: string | null;
  /** True once an Admin has 접수(accepted) the request (접수완료). */
  accepted: boolean;
  /**
   * Queue phase for Admin UI:
   * - REQUESTED: 접수 대기
   * - ACCEPTED: 접수완료 (생성 실행 가능)
   * - COMPLETED: 생성 완료 (품질 점검 등 후속 작업, 아직 DRAFT)
   */
  phase: "REQUESTED" | "ACCEPTED" | "COMPLETED";
  /** KnowledgePack.status — always DRAFT for this list today. */
  packStatus: string;
  providerReviewPhase: "NONE" | "REQUESTED" | "CONFIRMED" | "WITHDRAWN";
  serviceValidationPhase: "NONE" | "PASSED";
  workflowStatus: string;
  displayStatus: string;
  adminQueueGroup: string;
  ctaLabel: string;
  isWaitingForAdmin: boolean;
};

/**
 * List DRAFT packs with an open or completed ZIP generation request, newest
 * first, deduped by pack. Includes retired (PASS) markers so generation-complete
 * packs remain reachable until they leave DRAFT / enter REVIEWING.
 */
export async function listAdminWorkerZipRequests(input?: {
  prismaClient?: typeof prisma;
  env?: NodeJS.ProcessEnv;
  getRequestMetadata?: typeof getWorkerZipRequestMetadata;
  resolveWorkflowMarkers?: (
    packIds: string[],
  ) => Promise<
    Map<
      string,
      {
        providerReviewPhase: "NONE" | "REQUESTED" | "CONFIRMED" | "WITHDRAWN";
        serviceValidationPhase: "NONE" | "PASSED";
      }
    >
  >;
}): Promise<AdminWorkerZipRequestListItem[]> {
  const client = input?.prismaClient ?? prisma;
  const getRequestMetadata = input?.getRequestMetadata ?? getWorkerZipRequestMetadata;

  const runs = await client.pipelineRun.findMany({
    where: {
      triggerType: WORKER_ZIP_REQUEST_TRIGGER,
      status: { in: ["PENDING", WORKER_ZIP_REQUEST_ACCEPTED_STATUS, "PASS"] },
      pack: { status: PackStatus.DRAFT },
    },
    orderBy: { createdAt: "desc" },
    select: {
      packId: true,
      createdAt: true,
      startedAt: true,
      updatedAt: true,
      status: true,
      pack: {
        select: {
          status: true,
          name: true,
          categoryId: true,
          category: { select: { name: true } },
          providerProfile: { select: { displayName: true } },
          versions: {
            orderBy: latestKnowledgePackVersionOrderBy,
            take: 1,
            select: { id: true, version: true },
          },
        },
      },
    },
  });

  const seen = new Set<string>();
  const draftItems: Array<{
    packId: string;
    packName: string;
    providerName: string | null;
    categoryId: string | null;
    categoryName: string | null;
    versionLabel: string | null;
    requestedAt: string;
    acceptedAt: string | null;
    originalFileName: string | null;
    accepted: boolean;
    phase: "REQUESTED" | "ACCEPTED" | "COMPLETED";
    packStatus: string;
  }> = [];
  for (const run of runs) {
    if (seen.has(run.packId)) continue;
    seen.add(run.packId);
    const version = run.pack?.versions?.[0] ?? null;
    let originalFileName: string | null = null;
    if (version) {
      const meta = await getRequestMetadata({
        packId: run.packId,
        packVersionId: version.id,
        env: input?.env,
      }).catch(() => null);
      originalFileName = meta?.originalFileName ?? null;
    }
    const phase =
      run.status === "PASS"
        ? ("COMPLETED" as const)
        : run.status === WORKER_ZIP_REQUEST_ACCEPTED_STATUS
          ? ("ACCEPTED" as const)
          : ("REQUESTED" as const);
    const requestedAt = run.createdAt.toISOString();
    // startedAt is stamped on Admin 접수; fall back to updatedAt for ACCEPTED legacy rows.
    let acceptedAt: string | null = null;
    if (phase !== "REQUESTED") {
      const startedAt = run.startedAt ?? null;
      const updatedAt = run.updatedAt ?? null;
      if (startedAt && startedAt.getTime() > run.createdAt.getTime() + 1_000) {
        acceptedAt = startedAt.toISOString();
      } else if (phase === "ACCEPTED" && updatedAt) {
        acceptedAt = updatedAt.toISOString();
      } else if (startedAt) {
        acceptedAt = startedAt.toISOString();
      } else if (updatedAt) {
        acceptedAt = updatedAt.toISOString();
      }
    }
    draftItems.push({
      packId: run.packId,
      packName: run.pack?.name ?? run.packId,
      providerName: run.pack?.providerProfile?.displayName ?? null,
      categoryId: run.pack?.categoryId ?? null,
      categoryName: run.pack?.category?.name ?? null,
      versionLabel: version?.version ?? null,
      requestedAt,
      acceptedAt,
      originalFileName,
      accepted: phase === "ACCEPTED" || phase === "COMPLETED",
      phase,
      packStatus: run.pack?.status ?? PackStatus.DRAFT,
    });
  }

  // Recover DRAFT packs whose request markers were retired (SKIPPED/withdrawn)
  // after Admin already ran Worker ZIP import successfully.
  const completedImports = await client.pipelineRun.findMany({
    where: {
      triggerType: "WORKER_ZIP_IMPORT",
      status: "PASS",
      pack: { status: PackStatus.DRAFT },
      ...(seen.size > 0 ? { packId: { notIn: [...seen] } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      packId: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
      pack: {
        select: {
          status: true,
          name: true,
          categoryId: true,
          category: { select: { name: true } },
          providerProfile: { select: { displayName: true } },
          versions: {
            orderBy: latestKnowledgePackVersionOrderBy,
            take: 1,
            select: { id: true, version: true },
          },
        },
      },
    },
  });

  const recoveredPackIds: string[] = [];
  for (const run of completedImports) {
    if (seen.has(run.packId)) continue;
    seen.add(run.packId);
    recoveredPackIds.push(run.packId);
    const version = run.pack?.versions?.[0] ?? null;
    let originalFileName: string | null = null;
    if (version) {
      const meta = await getRequestMetadata({
        packId: run.packId,
        packVersionId: version.id,
        env: input?.env,
      }).catch(() => null);
      originalFileName = meta?.originalFileName ?? null;
    }
    draftItems.push({
      packId: run.packId,
      packName: run.pack?.name ?? run.packId,
      providerName: run.pack?.providerProfile?.displayName ?? null,
      categoryId: run.pack?.categoryId ?? null,
      categoryName: run.pack?.category?.name ?? null,
      versionLabel: version?.version ?? null,
      requestedAt: run.createdAt.toISOString(),
      acceptedAt: (run.startedAt ?? run.createdAt).toISOString(),
      originalFileName,
      accepted: true,
      phase: "COMPLETED",
      packStatus: run.pack?.status ?? PackStatus.DRAFT,
    });
  }

  if (recoveredPackIds.length > 0) {
    const legacyRequests = await client.pipelineRun.findMany({
      where: {
        packId: { in: recoveredPackIds },
        triggerType: WORKER_ZIP_REQUEST_TRIGGER,
      },
      orderBy: { createdAt: "asc" },
      select: {
        packId: true,
        createdAt: true,
        startedAt: true,
        updatedAt: true,
        status: true,
      },
    });
    const byPack = new Map<string, (typeof legacyRequests)[number][]>();
    for (const req of legacyRequests) {
      const list = byPack.get(req.packId) ?? [];
      list.push(req);
      byPack.set(req.packId, list);
    }
    for (const item of draftItems) {
      const reqs = byPack.get(item.packId);
      if (!reqs?.length) continue;
      const first = reqs[0]!;
      item.requestedAt = first.createdAt.toISOString();
      const acceptedReq = [...reqs].reverse().find(
        (r) =>
          r.status === WORKER_ZIP_REQUEST_ACCEPTED_STATUS ||
          r.status === "PASS" ||
          r.status === "SKIPPED",
      );
      if (acceptedReq) {
        const stamp =
          acceptedReq.startedAt &&
          acceptedReq.startedAt.getTime() > acceptedReq.createdAt.getTime() + 1_000
            ? acceptedReq.startedAt
            : acceptedReq.updatedAt;
        item.acceptedAt = stamp.toISOString();
      }
    }
  }

  const packIds = draftItems.map((item) => item.packId);
  const [releaseGateRuns, sourceValidationReports, structureCoverageReports, knowledgeQualityReports, chunkQualityReports, retrievalEvaluationRuns] =
    await Promise.all([
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

  const latestReleaseGateByPack = new Map<
    string,
    { checkedAt: Date; status: string }
  >();
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
  const markersByPack = input?.resolveWorkflowMarkers
    ? await input.resolveWorkflowMarkers(packIds)
    : input?.prismaClient
      ? new Map()
      : await batchResolveStoreWorkflowMarkers(packIds, client);

  return draftItems.map((item) => {
    const markers = markersByPack.get(item.packId);
    const providerReviewPhase = markers?.providerReviewPhase ?? "NONE";
    const serviceValidationPhase = markers?.serviceValidationPhase ?? "NONE";
    const view = buildAdminWorkInboxItemViewModel({
      packId: item.packId,
      packName: item.packName,
      packStatus: item.packStatus,
      sourceKind: "WORKER_ZIP",
      workerZipPhase: item.phase,
      providerReviewPhase,
      providerSupplementPhase: markers?.providerSupplementPhase ?? "NONE",
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
      qualityCheckedAt: qualityCheckedAtByPack.get(item.packId) ?? null,
      qualityStatus: qualityStatusByPack.get(item.packId) ?? "NOT_CHECKED",
    };
  });
}
