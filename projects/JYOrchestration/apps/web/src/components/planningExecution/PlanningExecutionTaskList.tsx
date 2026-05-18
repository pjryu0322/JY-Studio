"use client";

/**
 * Ordered task ids from view-model counts only — no task store / seed payload.
 */

import type { PlanningExecutionCountsViewModel } from "@jy-orch/application/public";

export function PlanningExecutionTaskList({ counts }: { readonly counts: PlanningExecutionCountsViewModel | null }) {
  if (!counts || counts.orderedTaskIds.length === 0) {
    return null;
  }
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4" aria-label="작업 순서">
      <h3 className="text-sm font-semibold text-neutral-800">작업 순서</h3>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-neutral-700">
        {counts.orderedTaskIds.map((id) => (
          <li key={id} className="font-mono text-xs">
            {id}
          </li>
        ))}
      </ol>
    </section>
  );
}
