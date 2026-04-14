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
  return (
    <div className="space-y-3">
      {c ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50/50 p-4" aria-label="Confirmation needed">
          <h3 className="text-sm font-semibold text-amber-950">Confirmation</h3>
          <p className="mt-2 text-sm text-amber-950">
            Confirm required: <strong>{c.confirmRequiredCount}</strong> · Blocking issues:{" "}
            <strong>{c.blockingIssueCount}</strong>
          </p>
        </section>
      ) : null}
      <PlanningExecutionMessagePanel title="Blocking / details" message={vm.message} />
    </div>
  );
}
