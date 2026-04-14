"use client";

import type { PlanningOriginatedExecutionViewModel } from "@jy-orch/application/public";
import { PlanningExecutionMessagePanel } from "./PlanningExecutionMessagePanel";

/** Execution readiness copy (prepared path) — view-model message only. */
export function PlanningExecutionReadinessPanel({ vm }: { readonly vm: PlanningOriginatedExecutionViewModel }) {
  return <PlanningExecutionMessagePanel title="Execution readiness" message={vm.message} />;
}
