import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  collectReviewBlockers,
  collectReviewWarnings,
} from "@/lib/admin-review-decision";
import { isPendingAdminReview } from "@/lib/admin-review-tabs";
import {
  ADMIN_REVIEW_BLOCKER_ISSUES_TITLE,
  ADMIN_REVIEW_WARNING_ISSUES_TITLE,
  ADMIN_REVIEW_WARNING_TAB_HINT,
} from "@/lib/role-based-ux-copy";

export function AdminReviewWarningIssuesTab({
  detail,
}: {
  readonly detail: AdminReviewDetailDto;
}) {
  const warnings = collectReviewWarnings(detail);
  const blockers = collectReviewBlockers(detail);
  const pending = isPendingAdminReview(detail);

  return (
    <section className="space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <div>
        <h2 className="text-sm font-bold text-slate-900">{ADMIN_REVIEW_WARNING_ISSUES_TITLE}</h2>
        {pending ? (
          <p className="mt-1 text-xs text-store-muted">{ADMIN_REVIEW_WARNING_TAB_HINT}</p>
        ) : null}
      </div>

      {blockers.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-bold text-red-900">{ADMIN_REVIEW_BLOCKER_ISSUES_TITLE}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-red-800">
            {blockers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-bold text-amber-950">
            {pending ? "접수 후 확인할 주의 항목" : "주의 이슈"}
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-amber-900">
            {warnings.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {blockers.length === 0 && warnings.length === 0 ? (
        <p className="text-xs text-store-muted">표시할 주의·차단 이슈가 없습니다.</p>
      ) : null}
    </section>
  );
}
