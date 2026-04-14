"use client";

import type { PlanningOriginatedExecutionViewModel } from "@jy-orch/application/public";
import { PlanningExecutionMessagePanel } from "./PlanningExecutionMessagePanel";

/** Confirmation counts + message — no refinement bundle. */
export function PlanningExecutionConfirmationOrBlockingPanel({
  vm,
}: {
  readonly vm: PlanningOriginatedExecutionViewModel;
}) {
  const c = vm.confirmationNeededSummary;
  const isConfirmation = vm.responseStatus === "NEEDS_CONFIRMATION";
  const isBlocked = vm.responseStatus === "BLOCKED";
  return (
    <div className="space-y-3">
      {isConfirmation && c ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50/50 p-4" aria-label="Confirmation needed">
          <h3 className="text-sm font-semibold text-amber-950">확인 필요</h3>
          <p className="mt-2 text-sm text-amber-950">
            확인 필요: <strong>{c.confirmRequiredCount}</strong> · 차단 이슈:{" "}
            <strong>{c.blockingIssueCount}</strong>
          </p>
          {vm.confirmationNeededQualitativeSummary ? (
            <p className="mt-2 text-sm text-amber-950">{vm.confirmationNeededQualitativeSummary}</p>
          ) : null}
        </section>
      ) : null}
      <PlanningExecutionMessagePanel
        title={isConfirmation ? "세부 정보" : isBlocked ? "왜 차단되었나요?" : "문제 원인"}
        message={vm.message}
      />
    </div>
  );
}
