import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  collectReviewActions,
  collectReviewBlockers,
  collectReviewRefreshReasons,
  collectReviewWarnings,
  resolveReviewDecisionState,
} from "@/lib/admin-review-decision";
import {
  ADMIN_REVIEW_NEEDS_ATTENTION_TITLE,
  ADMIN_REVIEW_REFRESH_REASONS_TITLE,
} from "@/lib/role-based-ux-copy";

export function AdminReviewNeedsAttention({
  detail,
}: {
  readonly detail: AdminReviewDetailDto;
}) {
  const state = resolveReviewDecisionState(detail);
  const blockers = collectReviewBlockers(detail);
  const warnings = collectReviewWarnings(detail);
  const actions = collectReviewActions(detail);
  const refreshReasons = collectReviewRefreshReasons(detail);

  if (
    state === "already_published" ||
    state === "not_reviewing" ||
    (blockers.length === 0 &&
      warnings.length === 0 &&
      actions.length === 0 &&
      refreshReasons.length === 0)
  ) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <h2 className="text-sm font-bold text-slate-900">{ADMIN_REVIEW_NEEDS_ATTENTION_TITLE}</h2>

      {state === "review_refresh_required" && refreshReasons.length > 0 ? (
        <div>
          <p className="text-xs font-bold text-amber-900">{ADMIN_REVIEW_REFRESH_REASONS_TITLE}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-amber-900">
            {refreshReasons.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {state === "submit_package_changed" && refreshReasons.length > 0 ? (
        <div>
          <p className="text-xs font-bold text-amber-900">제출 후 변경 감지</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-amber-900">
            {refreshReasons.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {blockers.length > 0 && state === "approval_blocked" ? (
        <div>
          <p className="text-xs font-bold text-red-800">차단</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-red-700">
            {blockers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length > 0 && state !== "review_refresh_required" ? (
        <div>
          <p className="text-xs font-bold text-amber-900">주의</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-amber-900">
            {warnings.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {actions.length > 0 ? (
        <div>
          <p className="text-xs font-bold text-slate-800">조치</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-store-muted">
            {actions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
