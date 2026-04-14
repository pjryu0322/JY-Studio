"use client";

import type { PlanningExecutionRunStatusResponse, PlanningOriginatedExecutionViewModel } from "@jy-orch/application/public";
import { PlanningExecutionMessagePanel } from "./PlanningExecutionMessagePanel";

/** Run id + status headline — no run store internals. */
export function PlanningExecutionExecutionStatusPanel({
  vm,
  runStatus,
  runStatusError,
}: {
  readonly vm: PlanningOriginatedExecutionViewModel;
  readonly runStatus: (PlanningExecutionRunStatusResponse & { ok: true })["run"] | null;
  readonly runStatusError: string | null;
}) {
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
        {runStatusError ? (
          <p className="mt-2 text-sm text-red-800" data-testid="run-status-error">
            {runStatusError}
          </p>
        ) : null}
        {runStatus ? (
          <dl className="mt-2 grid gap-2 text-sm text-neutral-700">
            <div className="flex justify-between gap-2">
              <dt className="text-neutral-500">상태</dt>
              <dd className="font-mono text-xs">{runStatus.runStatus}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-neutral-500">진행</dt>
              <dd>
                {runStatus.completedTasks}/{runStatus.totalTasks} (실패 {runStatus.failedTasks})
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-neutral-500">현재 작업</dt>
              <dd className="font-mono text-xs">{runStatus.currentTaskId ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-neutral-500">스텝 수</dt>
              <dd>{runStatus.totalStepCount}</dd>
            </div>
            {runStatus.lastFailureMessage ? (
              <div className="col-span-full text-sm text-red-800">{runStatus.lastFailureMessage}</div>
            ) : null}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-neutral-700">
            “실행 상태 보기”를 눌러 현재 run 상태를 불러옵니다. (상태 재평가는 계획/준비를 다시 평가합니다.)
          </p>
        )}
      </section>
      <PlanningExecutionMessagePanel title="세부 정보" message={vm.message} />
    </div>
  );
}
