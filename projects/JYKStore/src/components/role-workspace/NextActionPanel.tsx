"use client";

import type { NextReviewAction } from "@/lib/role-workspace/types";

export function NextActionPanel({
  action,
  onPrimary,
  onSecondary,
  busy = false,
}: {
  readonly action: NextReviewAction;
  readonly onPrimary?: () => void;
  readonly onSecondary?: () => void;
  readonly busy?: boolean;
}) {
  if (action.kind === "NONE" && !action.message) return null;

  const tone =
    action.tone === "blocked"
      ? "border-red-200 bg-red-50 text-red-900"
      : action.tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-emerald-200 bg-emerald-50 text-emerald-950";

  return (
    <section className={`space-y-2 rounded-2xl border px-4 py-3 shadow-card ${tone}`}>
      {action.message ? <p className="text-sm font-semibold">{action.message}</p> : null}
      {action.blockedReasons && action.blockedReasons.length > 0 ? (
        <ul className="list-disc space-y-0.5 pl-4 text-xs">
          {action.blockedReasons.slice(0, 5).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
      {action.kind !== "NONE" ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onPrimary}
            disabled={busy}
            className="min-h-[44px] flex-1 rounded-xl bg-slate-900 px-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {action.primaryLabel}
          </button>
          {action.secondaryLabel ? (
            <button
              type="button"
              onClick={onSecondary}
              disabled={busy}
              className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 disabled:opacity-60"
            >
              {action.secondaryLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
