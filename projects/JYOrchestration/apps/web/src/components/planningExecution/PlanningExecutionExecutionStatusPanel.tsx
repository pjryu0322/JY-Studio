"use client";

import type { PlanningOriginatedExecutionViewModel } from "@jy-orch/application/public";
import { PlanningExecutionMessagePanel } from "./PlanningExecutionMessagePanel";

/** Run id + status headline — no run store internals. */
export function PlanningExecutionExecutionStatusPanel({ vm }: { readonly vm: PlanningOriginatedExecutionViewModel }) {
  return (
    <div className="space-y-3">
      {vm.runId ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4" aria-label="Run identifier">
          <h3 className="text-sm font-semibold text-emerald-950">Run</h3>
          <p className="mt-1 font-mono text-sm text-emerald-900">{vm.runId}</p>
        </section>
      ) : null}
      <section className="rounded-lg border border-neutral-200 bg-white p-4" aria-label="Run monitoring">
        <h3 className="text-sm font-semibold text-neutral-800">실행 상태</h3>
        <p className="mt-2 text-sm text-neutral-700">
          현재 화면은 실행을 시작한 사실과 run id만 표시합니다. 실행 상태 조회/갱신 UX는 추후 제공됩니다.
        </p>
        <p className="mt-2 text-sm text-neutral-600">지금은 “상태 재평가”로 계획/준비 결과를 다시 확인할 수 있습니다.</p>
      </section>
      <PlanningExecutionMessagePanel title="세부 정보" message={vm.message} />
    </div>
  );
}
