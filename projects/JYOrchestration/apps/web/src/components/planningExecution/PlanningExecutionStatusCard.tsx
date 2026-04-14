"use client";

/**
 * Renders {@link PlanningExecutionStatusCardViewModel} only — no bundle or engine internals.
 */

import type { PlanningExecutionStatusCardViewModel } from "@jy-orch/application/public";

const toneBorder: Record<PlanningExecutionStatusCardViewModel["tone"], string> = {
  danger: "border-red-200 bg-red-50",
  warning: "border-amber-200 bg-amber-50",
  neutral: "border-neutral-200 bg-neutral-50",
  success: "border-emerald-200 bg-emerald-50",
};

export function PlanningExecutionStatusCard({ card }: { readonly card: PlanningExecutionStatusCardViewModel }) {
  const b = toneBorder[card.tone];
  return (
    <section
      className={`rounded-lg border p-4 ${b}`}
      aria-label="Planning execution status"
      data-planning-status={card.status}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-xs font-medium text-neutral-800">
          {card.badgeLabel}
        </span>
        <span className="text-xs font-mono text-neutral-500">{card.status}</span>
      </div>
      <h2 className="mt-2 text-base font-semibold text-neutral-900">{card.headline}</h2>
      <p className="mt-1 text-sm text-neutral-600">{card.nextActionLabel}</p>
    </section>
  );
}
