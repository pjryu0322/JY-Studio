"use client";

/**
 * Compact metrics from {@link PlanningExecutionCountsViewModel}; when null, shows placeholders (no fake counts).
 */

import type { PlanningExecutionCountsViewModel } from "@jy-orch/application/public";

export function PlanningExecutionCounts({ counts }: { readonly counts: PlanningExecutionCountsViewModel | null }) {
  if (!counts) {
    return (
      <section className="rounded-lg border border-dashed border-neutral-200 p-4 text-sm text-neutral-500" aria-label="Metrics">
        Metrics unavailable until execution preparation preview exists.
      </section>
    );
  }
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4" aria-label="Planning execution metrics">
      <h3 className="text-sm font-semibold text-neutral-800">Counts</h3>
      <dl className="mt-2 grid grid-cols-3 gap-3 text-center">
        <div>
          <dt className="text-xs text-neutral-500">Features</dt>
          <dd className="text-lg font-semibold text-neutral-900">{counts.featureCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Screens</dt>
          <dd className="text-lg font-semibold text-neutral-900">{counts.screenCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Tasks</dt>
          <dd className="text-lg font-semibold text-neutral-900">{counts.taskCount}</dd>
        </div>
      </dl>
    </section>
  );
}
