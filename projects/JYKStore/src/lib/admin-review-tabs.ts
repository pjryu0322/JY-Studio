import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import { PackReviewStatus } from "@/lib/pack-review-status";
import {
  isDistributionReviewSnapshot,
  isDoclingBundleReviewSnapshot,
} from "@/lib/provider-review-submit-snapshot";
import {
  ADMIN_REVIEW_TAB_PACKAGE,
  ADMIN_REVIEW_TAB_PROCESSING,
  ADMIN_REVIEW_TAB_SOURCES,
  ADMIN_REVIEW_TAB_WARNINGS,
} from "@/lib/role-based-ux-copy";
import { collectReviewBlockers, collectReviewWarnings } from "@/lib/admin-review-decision";

/** Evidence tabs only — decision/accept is a fixed top card, not a tab. */
export const ADMIN_REVIEW_EVIDENCE_TAB_IDS = [
  "package",
  "warnings",
  "documents",
  "processing",
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

export function hasDoclingReviewEvidence(detail: AdminReviewDetailDto): boolean {
  return isDoclingBundleReviewSnapshot(detail.latestReview?.submitSnapshot ?? null);
}

/** True when processing/evidence tab should be shown. */
export function hasProcessingReviewEvidence(detail: AdminReviewDetailDto): boolean {
  const snapshot = detail.latestReview?.submitSnapshot ?? null;
  return (
    isDoclingBundleReviewSnapshot(snapshot) ||
    isDistributionReviewSnapshot(snapshot) ||
    Boolean(detail.payload) ||
    Boolean(detail.doclingReviewIntegrity)
  );
}

export function defaultAdminReviewEvidenceTab(
  detail: AdminReviewDetailDto,
): AdminReviewEvidenceTabId {
  if (isAcceptedAdminReview(detail)) {
    if (collectReviewBlockers(detail).length > 0 || collectReviewWarnings(detail).length > 0) {
      return "warnings";
    }
    return "documents";
  }
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
    case "processing":
      return ADMIN_REVIEW_TAB_PROCESSING;
  }
}

/** @deprecated Use adminReviewEvidenceTabLabel */
export function adminReviewTabLabel(
  tabId: AdminReviewEvidenceTabId,
  _detail?: AdminReviewDetailDto,
): string {
  return adminReviewEvidenceTabLabel(tabId);
}
