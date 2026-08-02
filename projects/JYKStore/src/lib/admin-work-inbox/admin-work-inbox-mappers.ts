import type { AdminReviewListItemDto } from "@/lib/admin-review-dto";
import type {
  AdminProviderReturnedPackListItem,
  AdminWorkerZipRequestListItem,
} from "@/lib/admin-review-api";
import {
  buildAdminWorkInboxItemViewModel,
  type AdminWorkInboxItemViewModel,
  type AdminWorkInboxQueueGroup,
} from "@/lib/admin-work-inbox-view-model";
import type { ProviderSupplementAdminPhase } from "@/lib/provider-supplement-request";
import type { PackWorkflowRuntimeSummary } from "@/lib/workflow/pack-workflow-facts";

export type ReturnedInboxViewModel = AdminWorkInboxItemViewModel & { metaLine?: string };

function asWorkflowSummary(
  workflow: AdminWorkerZipRequestListItem["workflow"] | PackWorkflowRuntimeSummary | null | undefined,
): PackWorkflowRuntimeSummary | null {
  if (!workflow) return null;
  return workflow as PackWorkflowRuntimeSummary;
}

export function zipItemToViewModel(item: AdminWorkerZipRequestListItem): AdminWorkInboxItemViewModel {
  const workflow = asWorkflowSummary(item.workflow);
  if (item.displayStatus && item.adminQueueGroup && item.ctaLabel) {
    return {
      packId: item.packId,
      packName: item.packName,
      sourceKind: "WORKER_ZIP",
      packStatus: item.packStatus ?? "DRAFT",
      workflowStatus: (item.workflowStatus as AdminWorkInboxItemViewModel["workflowStatus"]) || "DRAFT",
      workerZipPhase: item.phase,
      providerReviewPhase: item.providerReviewPhase ?? "NONE",
      serviceValidationPhase: item.serviceValidationPhase ?? "NONE",
      packReviewStatus: null,
      adminQueueGroup: item.adminQueueGroup as AdminWorkInboxQueueGroup,
      displayStatus: item.displayStatus,
      ctaLabel: item.ctaLabel,
      isWaitingForAdmin: Boolean(item.isWaitingForAdmin),
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      providerName: item.providerName,
      versionLabel: item.versionLabel,
      providerSupplementPhase: "NONE",
      requestedAt: item.requestedAt ?? null,
      acceptedAt: item.acceptedAt ?? null,
      qualityCheckedAt: item.qualityCheckedAt ?? null,
      qualityStatus: item.qualityStatus ?? null,
      workflow,
    };
  }
  return buildAdminWorkInboxItemViewModel({
    packId: item.packId,
    packName: item.packName,
    packStatus: item.packStatus ?? "DRAFT",
    sourceKind: "WORKER_ZIP",
    workerZipPhase: item.phase,
    providerReviewPhase: item.providerReviewPhase ?? "NONE",
    serviceValidationPhase: item.serviceValidationPhase ?? "NONE",
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    providerName: item.providerName,
    versionLabel: item.versionLabel,
    requestedAt: item.requestedAt,
    acceptedAt: item.acceptedAt,
    qualityCheckedAt: item.qualityCheckedAt,
    qualityStatus: item.qualityStatus,
    workflow,
  });
}

export function reviewItemToViewModel(item: AdminReviewListItemDto): AdminWorkInboxItemViewModel {
  return buildAdminWorkInboxItemViewModel({
    packId: item.packId,
    packName: item.name,
    packStatus: item.status,
    sourceKind: "REVIEW",
    packReviewStatus: item.reviewStatus,
    providerReviewPhase: item.providerReviewPhase ?? "NONE",
    serviceValidationPhase: item.serviceValidationPhase ?? "NONE",
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    providerName: item.providerName,
    workflow: item.workflow ?? null,
  });
}

export function returnedItemToViewModel(item: AdminProviderReturnedPackListItem): ReturnedInboxViewModel {
  const submitted = item.withdrawnAt
    ? new Date(item.withdrawnAt).toLocaleString("ko-KR", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const metaLine = [
    item.providerName,
    item.changeTypeLabel,
    (item.targetCount ?? 0) > 0 ? `대상 ${item.targetCount}건` : null,
    item.changesRequest?.details
      ? item.changesRequest.details.length > 40
        ? `${item.changesRequest.details.slice(0, 40)}…`
        : item.changesRequest.details
      : null,
    submitted ? `제출 ${submitted}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const base = buildAdminWorkInboxItemViewModel({
    packId: item.packId,
    packName: item.packName,
    packStatus: item.packStatus ?? "DRAFT",
    sourceKind: "OTHER",
    providerReviewPhase: "WITHDRAWN",
    providerSupplementPhase: (item.providerSupplementPhase ??
      "PENDING") as ProviderSupplementAdminPhase,
    serviceValidationPhase: item.serviceValidationPhase ?? "NONE",
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    providerName: item.providerName,
    versionLabel: item.versionLabel,
    workflow: asWorkflowSummary(item.workflow),
  });

  return {
    ...base,
    displayStatus: item.displayStatus || base.displayStatus,
    ctaLabel: item.ctaLabel || base.ctaLabel,
    adminQueueGroup:
      (item.adminQueueGroup as AdminWorkInboxQueueGroup) || base.adminQueueGroup,
    isWaitingForAdmin:
      item.isWaitingForAdmin !== undefined
        ? Boolean(item.isWaitingForAdmin)
        : base.isWaitingForAdmin,
    metaLine,
  };
}
