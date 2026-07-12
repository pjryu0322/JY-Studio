import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import { PackReviewStatus } from "@/lib/pack-review-status";
import {
  ADMIN_REVIEW_TAB_PACKAGE,
  ADMIN_REVIEW_TAB_SOURCES,
  ADMIN_REVIEW_TAB_WARNINGS,
} from "@/lib/role-based-ux-copy";

/** Evidence tabs only — decision/accept is a fixed top card, not a tab. */
export const ADMIN_REVIEW_EVIDENCE_TAB_IDS = [
  "package",
  "warnings",
  "documents",
] as const;

export type AdminReviewEvidenceTabId =
  (typeof ADMIN_REVIEW_EVIDENCE_TAB_IDS)[number];

/** @deprecated Use AdminReviewEvidenceTabId */
export type AdminReviewTabId = AdminReviewEvidenceTabId;

export function isPendingAdminReview(detail: AdminReviewDetailDto): boolean {
  return (
    detail.pack.status === "REVIEWING" &&
    detail.latestReview?.status === PackReviewStatus.PENDING
  );
}

export function isAcceptedAdminReview(detail: AdminReviewDetailDto): boolean {
  return (
    detail.pack.status === "REVIEWING" &&
    detail.latestReview?.status === PackReviewStatus.IN_REVIEW
  );
}

export function isReviewPending(detail: AdminReviewDetailDto): boolean {
  return isPendingAdminReview(detail);
}

export function isReviewAccepted(detail: AdminReviewDetailDto): boolean {
  return isAcceptedAdminReview(detail);
}

export function defaultAdminReviewEvidenceTab(
  _detail: AdminReviewDetailDto,
): AdminReviewEvidenceTabId {
  return "package";
}

/** @deprecated Use defaultAdminReviewEvidenceTab */
export function defaultAdminReviewTab(
  detail: AdminReviewDetailDto,
): AdminReviewEvidenceTabId {
  return defaultAdminReviewEvidenceTab(detail);
}

export function adminReviewEvidenceTabLabel(
  tabId: AdminReviewEvidenceTabId,
): string {
  switch (tabId) {
    case "package":
      return ADMIN_REVIEW_TAB_PACKAGE;
    case "warnings":
      return ADMIN_REVIEW_TAB_WARNINGS;
    case "documents":
      return ADMIN_REVIEW_TAB_SOURCES;
  }
}

/** @deprecated Use adminReviewEvidenceTabLabel */
export function adminReviewTabLabel(
  tabId: AdminReviewEvidenceTabId,
  _detail?: AdminReviewDetailDto,
): string {
  return adminReviewEvidenceTabLabel(tabId);
}
