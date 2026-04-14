"use client";

import type { PlanningOriginatedExecutionViewModel } from "@jy-orch/application/public";

/** Planning-phase hints only (messages live in confirmation/blocking panel). */
export function PlanningExecutionPlanningSummaryPanel({ vm }: { readonly vm: PlanningOriginatedExecutionViewModel }) {
  const h = vm.planningHints;
  if (!h) return null;
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4" aria-label="Planning summary">
      <h3 className="text-sm font-semibold text-neutral-800">Planning result</h3>
      <dl className="mt-2 grid gap-2 text-sm text-neutral-700">
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Planning status</dt>
          <dd className="font-mono text-xs">{h.planningStatus ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Pipeline errors</dt>
          <dd>{h.pipelineErrorCount}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Executed steps</dt>
          <dd>{h.executedStepCount}</dd>
        </div>
        {h.stopHint ? (
          <div className="col-span-full text-xs text-neutral-600">
            <span className="font-medium text-neutral-700">Stop hint: </span>
            {h.stopHint}
          </div>
        ) : null}
      </dl>
    </section>
  );
}
