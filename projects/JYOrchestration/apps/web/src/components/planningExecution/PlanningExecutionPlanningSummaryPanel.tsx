"use client";

import type { PlanningOriginatedExecutionViewModel } from "@jy-orch/application/public";

/** Planning-phase hints only (messages live in confirmation/blocking panel). */
export function PlanningExecutionPlanningSummaryPanel({ vm }: { readonly vm: PlanningOriginatedExecutionViewModel }) {
  const h = vm.planningHints;
  if (!h) return null;
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4" aria-label="Planning summary">
      <h3 className="text-sm font-semibold text-neutral-800">계획 요약</h3>
      <dl className="mt-2 grid gap-2 text-sm text-neutral-700">
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">계획 상태</dt>
          <dd className="font-mono text-xs">{h.planningStatus ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">파이프라인 오류</dt>
          <dd>{h.pipelineErrorCount}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">실행된 단계</dt>
          <dd>{h.executedStepCount}</dd>
        </div>
        {h.stopHint ? (
          <div className="col-span-full text-xs text-neutral-600">
            <span className="font-medium text-neutral-700">중단 힌트: </span>
            {h.stopHint}
          </div>
        ) : null}
      </dl>
    </section>
  );
}
