"use client";

import type { PlanningExecutionRunStatusResponse, PlanningOriginatedExecutionViewModel } from "@jy-orch/application/public";
import { PlanningExecutionMessagePanel } from "./PlanningExecutionMessagePanel";
import { buildPlanningExecutionRunStatusPresentation } from "./planningExecutionRunStatusPresentation";

/** Run id + status headline — no run store internals. */
export function PlanningExecutionExecutionStatusPanel({
  vm,
  runStatus,
  runStatusError,
  onRunStatusRefresh,
  onInspectFailure,
}: {
  readonly vm: PlanningOriginatedExecutionViewModel;
  readonly runStatus: (PlanningExecutionRunStatusResponse & { ok: true })["run"] | null;
  readonly runStatusError: string | null;
  readonly onRunStatusRefresh: (() => void) | null;
  readonly onInspectFailure: (() => void) | null;
}) {
  const pres = runStatus ? buildPlanningExecutionRunStatusPresentation({ run: runStatus }) : null;
  return (
    <div className="space-y-3">
      {vm.runId ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4" aria-label="Run identifier">
          <h3 className="text-sm font-semibold text-emerald-950">Run</h3>
          <p className="mt-1 font-mono text-sm text-emerald-900">{vm.runId}</p>
        </section>
      ) : null}
      <section className="rounded-lg border border-neutral-200 bg-white p-4" aria-label="Run monitoring">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-neutral-800">실행 상태</h3>
          {onRunStatusRefresh ? (
            <button
              type="button"
              className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
              onClick={onRunStatusRefresh}
            >
              실행 상태 새로고침
            </button>
          ) : null}
        </div>
        {!onRunStatusRefresh && runStatus ? (
          <p className="mt-1 text-xs text-neutral-500">새로고침 중…</p>
        ) : null}
        {runStatusError ? (
          <p className="mt-2 text-sm text-red-800" data-testid="run-status-error">
            {runStatusError}
          </p>
        ) : null}
        {runStatus ? (
          <>
            <div
              className={
                pres?.tone === "danger"
                  ? "mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
                  : pres?.tone === "success"
                    ? "mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950"
                    : "mt-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800"
              }
              aria-label="Run status summary"
              data-testid="run-status-summary"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{pres?.summaryLine ?? "—"}</span>
                <span className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-xs font-medium text-neutral-800">
                  {pres?.statusLabel ?? "—"}
                </span>
              </div>
              {pres?.hintLine ? <p className="mt-1 text-xs text-neutral-600">{pres.hintLine}</p> : null}
              {runStatus.status === "FAILED" && onInspectFailure ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-red-900 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
                    onClick={onInspectFailure}
                  >
                    실패 원인 보기
                  </button>
                </div>
              ) : null}
            </div>
            <dl className="mt-2 grid gap-2 text-sm text-neutral-700">
              <div className="flex justify-between gap-2">
                <dt className="text-neutral-500">완료된 작업</dt>
                <dd>
                  {runStatus.completedTasks}/{runStatus.totalTasks}
                </dd>
              </div>
            <div className="flex justify-between gap-2">
              <dt className="text-neutral-500">진행률(작업 기준)</dt>
              <dd>{runStatus.progressPercent}%</dd>
            </div>
            <div className="col-span-full">
              <div className="h-2 w-full rounded-full bg-neutral-100">
                <div
                  className="h-2 rounded-full bg-neutral-800"
                  style={{ width: `${Math.max(0, Math.min(100, runStatus.progressPercent))}%` }}
                />
              </div>
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
          </>
        ) : (
          <p className="mt-2 text-sm text-neutral-700">
            실행 상태는 이 패널에서 확인합니다. “상태 재평가”는 계획/준비를 다시 평가하는 별도 동작입니다.
          </p>
        )}
      </section>
      <PlanningExecutionMessagePanel title="세부 정보" message={vm.message} />
    </div>
  );
}
