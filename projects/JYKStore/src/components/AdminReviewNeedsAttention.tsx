import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  collectReviewActions,
  collectReviewBlockers,
  collectReviewWarnings,
  resolveReviewDecisionState,
} from "@/lib/admin-review-decision";
import { ADMIN_REVIEW_NEEDS_ATTENTION_TITLE } from "@/lib/role-based-ux-copy";

export function AdminReviewNeedsAttention({
  detail,
}: {
  readonly detail: AdminReviewDetailDto;
}) {
  const state = resolveReviewDecisionState(detail);
  const blockers = collectReviewBlockers(detail);
  const warnings = collectReviewWarnings(detail);
  const actions = collectReviewActions(detail);

  if (
    state === "already_published" ||
    state === "not_reviewing" ||
    (blockers.length === 0 && warnings.length === 0 && actions.length === 0)
  ) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <h2 className="text-sm font-bold text-slate-900">{ADMIN_REVIEW_NEEDS_ATTENTION_TITLE}</h2>

      {blockers.length > 0 ? (
        <div>
          <p className="text-xs font-bold text-red-800">차단</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-red-700">
            {blockers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length > 0 ? (
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
