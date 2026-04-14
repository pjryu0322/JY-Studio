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
              <dd className="font-mono text-xs">{runStatus.status}</dd>
            </div>
            {runStatus.status === "FAILED" ? (
              <div className="col-span-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                실행이 중간에 실패했습니다. “실패 원인 보기”로 메시지를 확인하거나, “다시 시도”로 새 실행을 시작할 수 있습니다.
              </div>
            ) : null}
            <div className="flex justify-between gap-2">
              <dt className="text-neutral-500">진행률(작업 기준)</dt>
              <dd>{runStatus.progressPercent}%</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-neutral-500">현재 단계</dt>
              <dd className="font-mono text-xs">{runStatus.currentStep ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-neutral-500">스텝 수(로그)</dt>
              <dd>{runStatus.totalSteps}</dd>
            </div>
            {runStatus.lastMessage ? (
              <div className="col-span-full text-sm text-neutral-700">{runStatus.lastMessage}</div>
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
