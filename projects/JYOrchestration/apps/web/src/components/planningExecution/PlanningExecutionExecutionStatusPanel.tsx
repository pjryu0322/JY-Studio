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
      <PlanningExecutionMessagePanel title="Execution status" message={vm.message} />
    </div>
  );
}
