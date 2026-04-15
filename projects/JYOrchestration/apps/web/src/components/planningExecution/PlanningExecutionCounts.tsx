"use client";

/**
 * Compact metrics from {@link PlanningExecutionCountsViewModel}; when null, shows placeholders (no fake counts).
 */

import type { PlanningExecutionCountsViewModel } from "@jy-orch/application/public";

export function PlanningExecutionCounts({ counts }: { readonly counts: PlanningExecutionCountsViewModel | null }) {
  if (!counts) {
    return (
      <section className="rounded-lg border border-dashed border-neutral-200 p-4 text-sm text-neutral-500" aria-label="지표">
        실행 준비 미리보기가 있을 때까지 지표를 표시할 수 없습니다.
      </section>
    );
  }
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4" aria-label="계획 기반 실행 지표">
      <h3 className="text-sm font-semibold text-neutral-800">개수</h3>
      <dl className="mt-2 grid grid-cols-3 gap-3 text-center">
        <div>
          <dt className="text-xs text-neutral-500">기능</dt>
          <dd className="text-lg font-semibold text-neutral-900">{counts.featureCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">화면</dt>
          <dd className="text-lg font-semibold text-neutral-900">{counts.screenCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">작업</dt>
          <dd className="text-lg font-semibold text-neutral-900">{counts.taskCount}</dd>
        </div>
      </dl>
    </section>
  );
}
