/**
 * Admin inbox: provider structured 보완요청 (STORE_PROVIDER_SUPPLEMENT).
 * Also backfills legacy WITHDRAWN+changesRequest packs without a supplement marker.
 */

import { PackStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { latestKnowledgePackVersionOrderBy } from "@/lib/artifact-state/latest-pack-artifact-query";
import { buildAdminWorkInboxItemViewModel } from "@/lib/admin-work-inbox-view-model";
import { parseProviderChangesRequestSummary } from "@/lib/provider-review-workbench";
import {
  STORE_PROVIDER_SUPPLEMENT_TRIGGER,
  buildAdminSupplementQueueDisplay,
  buildInitialProviderSupplementState,
  changeTypeLabel,
  encodeProviderSupplementRequestState,
  mapSupplementStatusToAdminPhase,
  OPEN_SUPPLEMENT_PIPELINE_STATUSES,
  parseProviderSupplementRequestState,
} from "@/lib/provider-supplement-request";
import { STORE_PROVIDER_REVIEW_TRIGGER } from "./constants";
import type { AdminProviderReturnedPackListItem, PrismaClientLike } from "./types";

export async function listAdminProviderReturnedPacks(input?: {
  prismaClient?: PrismaClientLike;
}): Promise<AdminProviderReturnedPackListItem[]> {
  const client = input?.prismaClient ?? prisma;

  const supplementRuns = await client.pipelineRun.findMany({
    where: {
      triggerType: STORE_PROVIDER_SUPPLEMENT_TRIGGER,
      status: { in: [...OPEN_SUPPLEMENT_PIPELINE_STATUSES] },
      pack: { status: PackStatus.DRAFT },
    },
    orderBy: { createdAt: "desc" },
    select: {
      packId: true,
      status: true,
      summary: true,
      createdAt: true,
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
            select: { version: true },
          },
        },
      },
    },
  });

  const seen = new Set<string>();
  const items: AdminProviderReturnedPackListItem[] = [];

  for (const run of supplementRuns) {
    if (seen.has(run.packId)) continue;
    seen.add(run.packId);
    const state = parseProviderSupplementRequestState(run.summary);
    const phase =
      state?.adminPhase ?? mapSupplementStatusToAdminPhase(run.status);
    if (phase === "NONE" || phase === "WITHDRAWN") continue;
    const display = buildAdminSupplementQueueDisplay(phase);
    const version = run.pack?.versions?.[0] ?? null;
    const changesRequest = state
      ? {
          changeType: state.changeType,
          targetKind: state.targetKind,
          targetLabel: state.targetLabel ?? undefined,
          details: state.details,
        }
      : null;
    const view = buildAdminWorkInboxItemViewModel({
      packId: run.packId,
      packName: run.pack?.name ?? run.packId,
      packStatus: run.pack?.status ?? PackStatus.DRAFT,
      sourceKind: "OTHER",
      workerZipPhase: null,
      providerReviewPhase: "WITHDRAWN",
      providerSupplementPhase: phase,
      categoryId: run.pack?.categoryId ?? null,
      categoryName: run.pack?.category?.name ?? null,
      providerName: run.pack?.providerProfile?.displayName ?? null,
      versionLabel: version?.version ?? null,
    });

    items.push({
      packId: run.packId,
      packName: run.pack?.name ?? run.packId,
      providerName: run.pack?.providerProfile?.displayName ?? null,
      categoryId: run.pack?.categoryId ?? null,
      categoryName: run.pack?.category?.name ?? null,
      versionLabel: version?.version ?? null,
      withdrawnAt:
        state?.submittedAt ??
        run.finishedAt?.toISOString() ??
        run.createdAt.toISOString(),
      packStatus: run.pack?.status ?? PackStatus.DRAFT,
      providerReviewPhase: "WITHDRAWN",
      serviceValidationPhase: view.serviceValidationPhase,
      providerSupplementPhase: phase,
      changesRequest,
      changeTypeLabel: state ? changeTypeLabel(state.changeType) : null,
      targetCount: changesRequest ? 1 : 0,
      workflowStatus: view.workflowStatus,
      displayStatus: display.displayStatus,
      adminQueueGroup: "PROVIDER_SUPPLEMENT_REQUIRED",
      ctaLabel: display.ctaLabel,
      isWaitingForAdmin: display.isWaitingForAdmin,
    });
  }

  // Legacy: WITHDRAWN packs with changesRequest JSON but no supplement marker yet.
  const legacyRuns = await client.pipelineRun.findMany({
    where: {
      triggerType: STORE_PROVIDER_REVIEW_TRIGGER,
      status: "SKIPPED",
      pack: { status: PackStatus.DRAFT },
      ...(seen.size > 0 ? { packId: { notIn: [...seen] } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      packId: true,
      summary: true,
      createdAt: true,
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
            select: { version: true },
          },
        },
      },
    },
  });

  for (const run of legacyRuns) {
    if (seen.has(run.packId)) continue;
    const changesRequest = parseProviderChangesRequestSummary(run.summary);
    if (!changesRequest) continue;
    seen.add(run.packId);

    // Lazily create pending supplement marker so admin can accept/process.
    const state = buildInitialProviderSupplementState({
      changesRequest,
      submittedAt:
        run.finishedAt?.toISOString() ?? run.createdAt.toISOString(),
      clientId: "legacy-backfill",
    });
    await client.pipelineRun.create({
      data: {
        packId: run.packId,
        triggerType: STORE_PROVIDER_SUPPLEMENT_TRIGGER,
        triggeredByClientId: "legacy-backfill",
        status: "PENDING",
        startedAt: run.createdAt,
        summary: encodeProviderSupplementRequestState(state),
      },
    });

    const display = buildAdminSupplementQueueDisplay("PENDING");
    const version = run.pack?.versions?.[0] ?? null;
    items.push({
      packId: run.packId,
      packName: run.pack?.name ?? run.packId,
      providerName: run.pack?.providerProfile?.displayName ?? null,
      categoryId: run.pack?.categoryId ?? null,
      categoryName: run.pack?.category?.name ?? null,
      versionLabel: version?.version ?? null,
      withdrawnAt: state.submittedAt,
      packStatus: run.pack?.status ?? PackStatus.DRAFT,
      providerReviewPhase: "WITHDRAWN",
      serviceValidationPhase: "NONE",
      providerSupplementPhase: "PENDING",
      changesRequest,
      changeTypeLabel: changeTypeLabel(state.changeType),
      targetCount: 1,
      workflowStatus: "PROVIDER_WITHDRAWN",
      displayStatus: display.displayStatus,
      adminQueueGroup: "PROVIDER_SUPPLEMENT_REQUIRED",
      ctaLabel: display.ctaLabel,
      isWaitingForAdmin: true,
    });
  }

  return items;
}
