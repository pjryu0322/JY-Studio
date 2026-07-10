import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import { PackReviewStatus } from "@/lib/pack-review-status";
import {
  ADMIN_REVIEW_TAB_ACCEPT,
  ADMIN_REVIEW_TAB_ADVANCED,
  ADMIN_REVIEW_TAB_DECISION,
  ADMIN_REVIEW_TAB_PACKAGE,
  ADMIN_REVIEW_TAB_SOURCES,
  ADMIN_REVIEW_TAB_WARNINGS,
} from "@/lib/role-based-ux-copy";

export const ADMIN_REVIEW_TAB_IDS = [
  "accept",
  "package",
  "warnings",
  "sources",
  "advanced",
] as const;

export type AdminReviewTabId = (typeof ADMIN_REVIEW_TAB_IDS)[number];

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

/** Default tab is always the accept/decision tab; label changes by status. */
export function defaultAdminReviewTab(
  _detail: AdminReviewDetailDto,
): AdminReviewTabId {
  return "accept";
}

export function adminReviewAcceptTabLabel(detail: AdminReviewDetailDto): string {
  if (isPendingAdminReview(detail)) {
    return ADMIN_REVIEW_TAB_ACCEPT;
  }
  return ADMIN_REVIEW_TAB_DECISION;
}

export function adminReviewTabLabel(
  tabId: AdminReviewTabId,
  detail: AdminReviewDetailDto,
): string {
  switch (tabId) {
    case "accept":
      return adminReviewAcceptTabLabel(detail);
    case "package":
      return ADMIN_REVIEW_TAB_PACKAGE;
    case "warnings":
      return ADMIN_REVIEW_TAB_WARNINGS;
    case "sources":
      return ADMIN_REVIEW_TAB_SOURCES;
    case "advanced":
      return ADMIN_REVIEW_TAB_ADVANCED;
  }
}
