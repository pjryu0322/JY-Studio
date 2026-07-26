/**
 * Admin work-inbox ViewModel — derives display/queue/CTA from existing
 * PackStatus + workflow markers + Worker ZIP phase. No new DB enums.
 */

import type { PackStatus } from "@prisma/client";
import { isOpenPackReviewStatus, PackReviewStatus } from "@/lib/pack-review-status";
import {
  deriveStoreWorkflowStatus,
  type StoreProviderReviewPhase,
  type StoreServiceValidationPhase,
  type StoreWorkflowStatus,
} from "@/lib/store-workflow-status";
import {
  buildAdminSupplementQueueDisplay,
  type ProviderSupplementAdminPhase,
} from "@/lib/provider-supplement-request";

export const ADMIN_WORK_INBOX_QUEUE_GROUPS = [
  "ACCEPT_REQUIRED",
  "GENERATE_REQUIRED",
  "QUALITY_CHECK_REQUIRED",
  "PROVIDER_REVIEW_IN_PROGRESS",
  "PROVIDER_SUPPLEMENT_REQUIRED",
  "ADMIN_REVIEW_REQUIRED",
  "ADMIN_REVIEW_IN_PROGRESS",
  "PUBLISHED",
  "RETURNED_OR_REJECTED",
  "OTHER",
] as const;

export type AdminWorkInboxQueueGroup = (typeof ADMIN_WORK_INBOX_QUEUE_GROUPS)[number];

export type AdminWorkInboxSourceKind = "WORKER_ZIP" | "REVIEW" | "PUBLISHED" | "OTHER";

export type AdminWorkInboxItemSource = {
  packId: string;
  packName: string;
  packStatus: PackStatus | string;
  sourceKind?: AdminWorkInboxSourceKind;
  workerZipPhase?: "REQUESTED" | "ACCEPTED" | "COMPLETED" | null;
  providerReviewPhase?: StoreProviderReviewPhase | null;
  providerSupplementPhase?: ProviderSupplementAdminPhase | "NONE" | null;
  serviceValidationPhase?: StoreServiceValidationPhase | null;
  /** Latest PackReview.status when available. */
  packReviewStatus?: string | null;
  latestRejectionReason?: string | null;
  adminQualityPassed?: boolean;
  adminQualityStarted?: boolean;
  categoryId?: string | null;
  categoryName?: string | null;
  providerName?: string | null;
  versionLabel?: string | null;
};

export type AdminWorkInboxItemViewModel = {
  packId: string;
  packName: string;
  sourceKind: AdminWorkInboxSourceKind;
  packStatus: string;
  workflowStatus: StoreWorkflowStatus;
  workerZipPhase: "REQUESTED" | "ACCEPTED" | "COMPLETED" | null;
  providerReviewPhase: StoreProviderReviewPhase;
  providerSupplementPhase: ProviderSupplementAdminPhase | "NONE";
  serviceValidationPhase: StoreServiceValidationPhase;
  packReviewStatus: string | null;
  adminQueueGroup: AdminWorkInboxQueueGroup;
  displayStatus: string;
  ctaLabel: string;
  isWaitingForAdmin: boolean;
  categoryId: string | null;
  categoryName: string | null;
  providerName: string | null;
  versionLabel: string | null;
};

export function buildAdminWorkInboxItemViewModel(
  input: AdminWorkInboxItemSource,
): AdminWorkInboxItemViewModel {
  const packStatus = String(input.packStatus ?? "DRAFT");
  const workerZipPhase = input.workerZipPhase ?? null;
  const providerReviewPhase = input.providerReviewPhase ?? "NONE";
  const providerSupplementPhase = input.providerSupplementPhase ?? "NONE";
  const serviceValidationPhase = input.serviceValidationPhase ?? "NONE";
  const packReviewStatus = input.packReviewStatus?.trim() || null;

  const workflowStatus = deriveStoreWorkflowStatus({
    packStatus,
    workerZipRequestStatus: workerZipPhase,
    adminGenerationHold:
      workerZipPhase === "ACCEPTED" || workerZipPhase === "COMPLETED"
        ? workerZipPhase
        : null,
    providerReviewPhase,
    serviceValidationPhase,
    latestRejectionReason: input.latestRejectionReason,
    adminQualityPassed: input.adminQualityPassed,
    adminQualityStarted: input.adminQualityStarted,
  });

  const mapped = mapQueuePresentation({
    packStatus,
    workflowStatus,
    workerZipPhase,
    providerReviewPhase,
    providerSupplementPhase,
    packReviewStatus,
  });

  const sourceKind =
    input.sourceKind ??
    (mapped.adminQueueGroup === "PUBLISHED"
      ? "PUBLISHED"
      : packStatus === "REVIEWING"
        ? "REVIEW"
        : workerZipPhase
          ? "WORKER_ZIP"
          : "OTHER");

  return {
    packId: input.packId,
    packName: input.packName,
    sourceKind,
    packStatus,
    workflowStatus,
    workerZipPhase,
    providerReviewPhase,
    providerSupplementPhase,
    serviceValidationPhase,
    packReviewStatus,
    adminQueueGroup: mapped.adminQueueGroup,
    displayStatus: mapped.displayStatus,
    ctaLabel: mapped.ctaLabel,
    isWaitingForAdmin: mapped.isWaitingForAdmin,
    categoryId: input.categoryId ?? null,
    categoryName: input.categoryName ?? null,
    providerName: input.providerName ?? null,
    versionLabel: input.versionLabel ?? null,
  };
}

function mapQueuePresentation(input: {
  packStatus: string;
  workflowStatus: StoreWorkflowStatus;
  workerZipPhase: "REQUESTED" | "ACCEPTED" | "COMPLETED" | null;
  providerReviewPhase: StoreProviderReviewPhase;
  providerSupplementPhase: ProviderSupplementAdminPhase | "NONE";
  packReviewStatus: string | null;
}): {
  adminQueueGroup: AdminWorkInboxQueueGroup;
  displayStatus: string;
  ctaLabel: string;
  isWaitingForAdmin: boolean;
} {
  if (input.packStatus === "PUBLISHED" || input.packStatus === "VERIFIED") {
    return {
      adminQueueGroup: "PUBLISHED",
      displayStatus: "공개 중",
      ctaLabel: "공개 상세 보기",
      isWaitingForAdmin: false,
    };
  }

  if (input.packStatus === "REVIEWING") {
    if (input.packReviewStatus === PackReviewStatus.IN_REVIEW) {
      return {
        adminQueueGroup: "ADMIN_REVIEW_IN_PROGRESS",
        displayStatus: "검수 중",
        ctaLabel: "검수 계속하기",
        isWaitingForAdmin: true,
      };
    }
    if (
      !input.packReviewStatus ||
      input.packReviewStatus === PackReviewStatus.PENDING ||
      isOpenPackReviewStatus(input.packReviewStatus)
    ) {
      return {
        adminQueueGroup: "ADMIN_REVIEW_REQUIRED",
        displayStatus: "검수 요청 접수",
        ctaLabel: "검수 시작",
        isWaitingForAdmin: true,
      };
    }
  }

  // Provider structured 보완요청 — highest priority among DRAFT overlays.
  if (
    input.providerSupplementPhase === "PENDING" ||
    input.providerSupplementPhase === "ACCEPTED" ||
    input.providerSupplementPhase === "CLARIFY" ||
    input.providerSupplementPhase === "RESOLVED" ||
    input.providerSupplementPhase === "REJECTED"
  ) {
    const display = buildAdminSupplementQueueDisplay(input.providerSupplementPhase);
    return {
      adminQueueGroup: "PROVIDER_SUPPLEMENT_REQUIRED",
      displayStatus: display.displayStatus,
      ctaLabel: display.ctaLabel,
      isWaitingForAdmin: display.isWaitingForAdmin,
    };
  }

  if (input.workflowStatus === "REJECTED") {
    return {
      adminQueueGroup: "RETURNED_OR_REJECTED",
      displayStatus: "보완 요청",
      ctaLabel: "보완 내역 보기",
      isWaitingForAdmin: false,
    };
  }

  if (
    input.workflowStatus === "PROVIDER_WITHDRAWN" ||
    input.providerReviewPhase === "WITHDRAWN"
  ) {
    // Plain withdraw (no structured supplement) — provider re-registers materials.
    return {
      adminQueueGroup: "OTHER",
      displayStatus: "제공자 회수",
      ctaLabel: "상세 보기",
      isWaitingForAdmin: false,
    };
  }

  if (input.providerReviewPhase === "REQUESTED") {
    return {
      adminQueueGroup: "PROVIDER_REVIEW_IN_PROGRESS",
      displayStatus: "제공자 검토 중",
      ctaLabel: "검토 요청 내역 보기",
      isWaitingForAdmin: false,
    };
  }

  if (input.providerReviewPhase === "CONFIRMED") {
    return {
      adminQueueGroup: "ADMIN_REVIEW_REQUIRED",
      displayStatus: "검수 요청 접수",
      ctaLabel: "검수 시작",
      isWaitingForAdmin: true,
    };
  }

  if (input.workerZipPhase === "COMPLETED" || input.workerZipPhase === "ACCEPTED") {
    return {
      adminQueueGroup: "GENERATE_REQUIRED",
      displayStatus: "생성·품질보정 대기",
      ctaLabel: "생성·품질보정",
      isWaitingForAdmin: true,
    };
  }

  if (input.workerZipPhase === "REQUESTED") {
    return {
      adminQueueGroup: "ACCEPT_REQUIRED",
      displayStatus: "접수 대기",
      ctaLabel: "자료 접수",
      isWaitingForAdmin: true,
    };
  }

  return {
    adminQueueGroup: "OTHER",
    displayStatus: "기타",
    ctaLabel: "상세 보기",
    isWaitingForAdmin: false,
  };
}

/** Deduplicate by packId; prefer REVIEW / higher-priority queue groups. */
export function mergeAdminWorkInboxViewModels(
  items: readonly AdminWorkInboxItemViewModel[],
): AdminWorkInboxItemViewModel[] {
  const rank: Record<AdminWorkInboxQueueGroup, number> = {
    ADMIN_REVIEW_IN_PROGRESS: 0,
    PROVIDER_SUPPLEMENT_REQUIRED: 1,
    ADMIN_REVIEW_REQUIRED: 2,
    QUALITY_CHECK_REQUIRED: 3,
    GENERATE_REQUIRED: 4,
    ACCEPT_REQUIRED: 5,
    PROVIDER_REVIEW_IN_PROGRESS: 6,
    RETURNED_OR_REJECTED: 7,
    PUBLISHED: 8,
    OTHER: 9,
  };
  const byPack = new Map<string, AdminWorkInboxItemViewModel>();
  for (const item of items) {
    const prev = byPack.get(item.packId);
    if (!prev || rank[item.adminQueueGroup] < rank[prev.adminQueueGroup]) {
      byPack.set(item.packId, item);
    }
  }
  return [...byPack.values()];
}

export function countAdminWorkInboxWaiting(
  items: readonly AdminWorkInboxItemViewModel[],
): number {
  return items.filter((item) => item.isWaitingForAdmin).length;
}

export function filterAdminWorkInboxByQueueGroup(
  items: readonly AdminWorkInboxItemViewModel[],
  group: AdminWorkInboxQueueGroup,
): AdminWorkInboxItemViewModel[] {
  return items.filter((item) => item.adminQueueGroup === group);
}
