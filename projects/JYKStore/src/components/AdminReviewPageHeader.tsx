import Link from "next/link";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  resolveDecisionStatusCopy,
  resolvePendingAcceptCopy,
} from "@/lib/admin-review-decision";
import {
  isAcceptedAdminReview,
  isPendingAdminReview,
} from "@/lib/admin-review-tabs";
import { ROUTES } from "@/lib/routes";
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
    <div className="space-y-2">
      <Link
        href={ROUTES.adminReviews}
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
      >
        ← 검수 대기 목록
      </Link>
      <div>
        <h1 className="text-base font-bold text-slate-900">관리자 검수 상세</h1>
        <p className="mt-1 text-xs text-store-muted">상태: {statusLabel}</p>
        <p className="mt-0.5 text-sm font-semibold text-slate-800">{detail.pack.name}</p>
        <p className="font-mono text-[11px] text-store-muted">{detail.pack.packId}</p>
      </div>
    </div>
  );
}
