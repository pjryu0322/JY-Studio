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
  /** Provider 생성 요청(ZIP) 시각 — ISO. */
  requestedAt?: string | null;
  /** Admin 접수 시각 — ISO. */
  acceptedAt?: string | null;
  /** Quality refresh confirmed 시각 — ISO. */
  qualityCheckedAt?: string | null;
  /** NOT_CHECKED / IN_PROGRESS / PASS / WARNING / FAIL */
  qualityStatus?: string | null;
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
  requestedAt: string | null;
  acceptedAt: string | null;
  qualityCheckedAt: string | null;
  qualityStatus: string | null;
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
    serviceValidationPhase,
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
    requestedAt: input.requestedAt?.trim() || null,
    acceptedAt: input.acceptedAt?.trim() || null,
    qualityCheckedAt: input.qualityCheckedAt?.trim() || null,
    qualityStatus: input.qualityStatus?.trim() || null,
  };
}

function mapQueuePresentation(input: {
  packStatus: string;
  workflowStatus: StoreWorkflowStatus;
  workerZipPhase: "REQUESTED" | "ACCEPTED" | "COMPLETED" | null;
  providerReviewPhase: StoreProviderReviewPhase;
  providerSupplementPhase: ProviderSupplementAdminPhase | "NONE";
  serviceValidationPhase: StoreServiceValidationPhase;
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
    // Service validation must complete before final approval — even while REVIEWING.
    if (input.serviceValidationPhase !== "PASSED") {
      return {
        adminQueueGroup: "ADMIN_REVIEW_REQUIRED",
        displayStatus: "서비스 검증 대기",
        ctaLabel: "서비스 검증",
        isWaitingForAdmin: true,
      };
    }
    if (input.packReviewStatus === PackReviewStatus.IN_REVIEW) {
      return {
        adminQueueGroup: "ADMIN_REVIEW_IN_PROGRESS",
        displayStatus: "승인·게시 진행 중",
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
        displayStatus: "승인·게시 대기",
        ctaLabel: "승인·게시",
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
    // Legacy / edge: provider confirmed before SV — still need SV first for publish.
    if (input.serviceValidationPhase !== "PASSED") {
      return {
        adminQueueGroup: "ADMIN_REVIEW_REQUIRED",
        displayStatus: "서비스 검증 대기",
        ctaLabel: "서비스 검증",
        isWaitingForAdmin: true,
      };
    }
    return {
      adminQueueGroup: "ADMIN_REVIEW_REQUIRED",
      displayStatus: "승인·게시 대기",
      ctaLabel: "승인·게시",
      isWaitingForAdmin: true,
    };
  }

  // P2 order: generation complete → service validation (before provider review).
  if (input.workerZipPhase === "COMPLETED") {
    if (input.serviceValidationPhase !== "PASSED") {
      return {
        adminQueueGroup: "ADMIN_REVIEW_REQUIRED",
        displayStatus: "서비스 검증 대기",
        ctaLabel: "서비스 검증",
        isWaitingForAdmin: true,
      };
    }
    return {
      adminQueueGroup: "ADMIN_REVIEW_REQUIRED",
      displayStatus: "제공자 검토·게시 대기",
      ctaLabel: "게시",
      isWaitingForAdmin: true,
    };
  }

  if (input.workerZipPhase === "ACCEPTED") {
    return {
      adminQueueGroup: "GENERATE_REQUIRED",
      displayStatus: "지식화 대상·생성 대기",
      ctaLabel: "지식화 대상 확인",
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
  const phaseRank: Record<"REQUESTED" | "ACCEPTED" | "COMPLETED", number> = {
    REQUESTED: 1,
    ACCEPTED: 2,
    COMPLETED: 3,
  };
  const preferPhase = (
    a: AdminWorkInboxItemViewModel["workerZipPhase"],
    b: AdminWorkInboxItemViewModel["workerZipPhase"],
  ): AdminWorkInboxItemViewModel["workerZipPhase"] => {
    if (!a) return b;
    if (!b) return a;
    return phaseRank[a] >= phaseRank[b] ? a : b;
  };

  const byPack = new Map<string, AdminWorkInboxItemViewModel>();
  for (const item of items) {
    const prev = byPack.get(item.packId);
    if (!prev) {
      byPack.set(item.packId, item);
      continue;
    }
    const takeIncoming = rank[item.adminQueueGroup] < rank[prev.adminQueueGroup];
    const primary = takeIncoming ? item : prev;
    const secondary = takeIncoming ? prev : item;
    byPack.set(item.packId, {
      ...primary,
      workerZipPhase: preferPhase(primary.workerZipPhase, secondary.workerZipPhase),
      requestedAt: primary.requestedAt ?? secondary.requestedAt,
      acceptedAt: primary.acceptedAt ?? secondary.acceptedAt,
    });
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

/**
 * Packs that belong on the admin 생성·품질보정 stage rail (legacy combined).
 * Prefer the split helpers below for new stage rails.
 */
export function isAdminGenerationQualityQueueItem(
  item: AdminWorkInboxItemViewModel,
): boolean {
  return (
    isAdminGenerationQueueItem(item) ||
    isAdminQualityQueueItem(item) ||
    isAdminCorrectionQueueItem(item)
  );
}

export function filterAdminGenerationQualityQueue(
  items: readonly AdminWorkInboxItemViewModel[],
): AdminWorkInboxItemViewModel[] {
  return items.filter(isAdminGenerationQualityQueueItem);
}

/** 자료 접수 후 지식화 대상 확인·생성 대기 (ACCEPTED). COMPLETED는 서비스 검증으로. */
export function isAdminGenerationQueueItem(item: AdminWorkInboxItemViewModel): boolean {
  if (item.packStatus === "PUBLISHED" || item.packStatus === "VERIFIED") return false;
  if (item.adminQueueGroup === "ACCEPT_REQUIRED") return false;
  if (item.providerReviewPhase === "REQUESTED" || item.providerReviewPhase === "CONFIRMED") {
    return false;
  }
  // Keep ACCEPTED visible even when a provider-supplement overlay wins the inbox group.
  return item.workerZipPhase === "ACCEPTED";
}

/** P2: knowledge-scope queue — accepted packs awaiting scope confirm / generation start. */
export function isAdminKnowledgeScopeQueueItem(item: AdminWorkInboxItemViewModel): boolean {
  return isAdminGenerationQueueItem(item);
}

/** @deprecated P2 — quality folded into generation; kept for session-ack correction routing. */
export function isAdminQualityQueueItem(item: AdminWorkInboxItemViewModel): boolean {
  if (item.packStatus === "PUBLISHED" || item.packStatus === "VERIFIED") return false;
  if (item.providerReviewPhase === "REQUESTED" || item.providerReviewPhase === "CONFIRMED") {
    return false;
  }
  if (item.serviceValidationPhase === "PASSED") return false;
  // Quality review of COMPLETED packs that have not entered SV yet.
  return item.workerZipPhase === "COMPLETED";
}

/** 제공자 보완요청(구조화) — 보정 큐 포함 */
export function isAdminCorrectionSupplementItem(
  item: AdminWorkInboxItemViewModel,
): boolean {
  if (item.packStatus === "PUBLISHED" || item.packStatus === "VERIFIED") return false;
  return item.adminQueueGroup === "PROVIDER_SUPPLEMENT_REQUIRED";
}

/**
 * 보정 큐 후보.
 * - 제공자 보완요청
 * - 자동품질점검에서 「완료」한 건 (`qualityAcknowledged`)
 */
export function isAdminCorrectionQueueItem(
  item: AdminWorkInboxItemViewModel,
  options?: { readonly qualityAcknowledged?: boolean },
): boolean {
  if (item.packStatus === "PUBLISHED" || item.packStatus === "VERIFIED") return false;
  if (isAdminCorrectionSupplementItem(item)) return true;
  if (options?.qualityAcknowledged && item.workerZipPhase === "COMPLETED") {
    return true;
  }
  return false;
}

/** Client filter: supplements + quality-review-acknowledged packs. */
export function filterAdminCorrectionQueue(
  items: readonly AdminWorkInboxItemViewModel[],
  isQualityAcknowledged: (packId: string) => boolean,
): AdminWorkInboxItemViewModel[] {
  return items.filter((item) =>
    isAdminCorrectionQueueItem(item, {
      qualityAcknowledged: isQualityAcknowledged(item.packId),
    }),
  );
}

export function filterAdminWorkQueue(
  items: readonly AdminWorkInboxItemViewModel[],
  queue:
    | "all"
    | "receipt"
    | "knowledge-scope"
    | "generation"
    | "correction"
    | "service-validation"
    | "publish"
    /** @deprecated */
    | "accept"
    /** @deprecated */
    | "quality"
    /** @deprecated */
    | "provider-review"
    /** @deprecated */
    | "approval-publish",
): AdminWorkInboxItemViewModel[] {
  switch (queue) {
    case "receipt":
    case "accept":
      return items.filter((i) => i.adminQueueGroup === "ACCEPT_REQUIRED");
    case "knowledge-scope":
      return items.filter(isAdminKnowledgeScopeQueueItem);
    case "generation":
    case "quality":
      return items.filter(
        (i) => isAdminGenerationQueueItem(i) || isAdminQualityQueueItem(i),
      );
    case "correction":
      // Session quality-ack is applied in the inbox client via filterAdminCorrectionQueue.
      return items.filter(isAdminCorrectionSupplementItem);
    case "service-validation":
      return items.filter(
        (i) =>
          i.adminQueueGroup === "ADMIN_REVIEW_REQUIRED" &&
          i.serviceValidationPhase !== "PASSED",
      );
    case "publish":
    case "provider-review":
    case "approval-publish":
      return items.filter(
        (i) =>
          i.adminQueueGroup === "PROVIDER_REVIEW_IN_PROGRESS" ||
          i.adminQueueGroup === "ADMIN_REVIEW_IN_PROGRESS" ||
          (i.adminQueueGroup === "ADMIN_REVIEW_REQUIRED" &&
            i.serviceValidationPhase === "PASSED"),
      );
    default:
      return items;
  }
}

/** Split ADMIN_REVIEW_REQUIRED by Store service-validation marker. */
export function partitionAdminReviewRequiredByServicePhase(
  items: readonly AdminWorkInboxItemViewModel[],
): {
  serviceValidationWaiting: AdminWorkInboxItemViewModel[];
  approvalWaiting: AdminWorkInboxItemViewModel[];
} {
  const required = items.filter((item) => item.adminQueueGroup === "ADMIN_REVIEW_REQUIRED");
  return {
    serviceValidationWaiting: required.filter(
      (item) => item.serviceValidationPhase !== "PASSED",
    ),
    approvalWaiting: required.filter((item) => item.serviceValidationPhase === "PASSED"),
  };
}
