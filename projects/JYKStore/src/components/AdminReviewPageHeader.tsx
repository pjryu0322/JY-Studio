import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  resolveDecisionStatusCopy,
  resolvePendingAcceptCopy,
} from "@/lib/admin-review-decision";
import {
  isAcceptedAdminReview,
  isPendingAdminReview,
} from "@/lib/admin-review-tabs";
import {
  ADMIN_REVIEWS_STATUS_IN_REVIEW,
  ADMIN_REVIEWS_STATUS_PENDING,
} from "@/lib/role-based-ux-copy";

export function AdminReviewPageHeader({
  detail,
}: {
  readonly detail: AdminReviewDetailDto;
}) {
  const pending = isPendingAdminReview(detail);
  const accepted = isAcceptedAdminReview(detail);
  const statusLabel = pending
    ? `${ADMIN_REVIEWS_STATUS_PENDING} · ${resolvePendingAcceptCopy(detail).title}`
    : accepted
      ? `${ADMIN_REVIEWS_STATUS_IN_REVIEW} · ${resolveDecisionStatusCopy(detail).title}`
      : detail.pack.status;

  return (
    <div className="rounded-2xl border border-store-border bg-white px-4 py-3 shadow-card">
      <p className="text-sm font-semibold text-slate-900">{detail.pack.name}</p>
      <p className="mt-0.5 font-mono text-[11px] text-store-muted">{detail.pack.packId}</p>
      <p className="mt-1 text-xs text-store-muted">상태: {statusLabel}</p>
    </div>
  );
}
