/** PackReview.status string values (schema uses free-form String). */
export const PackReviewStatus = {
  PENDING: "PENDING",
  IN_REVIEW: "IN_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  WITHDRAWN: "WITHDRAWN",
} as const;

export type PackReviewStatusValue =
  (typeof PackReviewStatus)[keyof typeof PackReviewStatus];

/** Open reviews that admin can still decide on. */
export const OPEN_PACK_REVIEW_STATUSES = [
  PackReviewStatus.PENDING,
  PackReviewStatus.IN_REVIEW,
] as const;

export function isOpenPackReviewStatus(status: string): boolean {
  return (
    status === PackReviewStatus.PENDING || status === PackReviewStatus.IN_REVIEW
  );
}

/** Provider may withdraw only before admin accepts (접수). */
export function canProviderWithdrawReview(reviewStatus: string | null | undefined): boolean {
  return reviewStatus === PackReviewStatus.PENDING;
}

/** Admin may approve/reject only after accept (접수). */
export function isAdminReviewAccepted(reviewStatus: string | null | undefined): boolean {
  return reviewStatus === PackReviewStatus.IN_REVIEW;
}
