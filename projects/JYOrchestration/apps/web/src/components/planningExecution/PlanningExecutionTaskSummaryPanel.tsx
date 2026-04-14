"use client";

/**
 * Task / screen summary: feature/screen/task counts + ordered task ids from {@link PlanningOriginatedExecutionViewModel}
 * only. Does not load task store or seed payloads.
 *
 * The workspace often renders {@link PlanningExecutionCounts} and {@link PlanningExecutionTaskList} as separate
 * `METRICS_ROW` / `TASK_SCREEN_SUMMARY_PANEL` sections; this composes both for simpler embeds.
 */

import type { PlanningOriginatedExecutionViewModel } from "@jy-orch/application/public";
import { PlanningExecutionCounts } from "./PlanningExecutionCounts";
import { PlanningExecutionTaskList } from "./PlanningExecutionTaskList";

export function PlanningExecutionTaskSummaryPanel({ vm }: { readonly vm: PlanningOriginatedExecutionViewModel }) {
  return (
    <div className="space-y-3" data-testid="planning-execution-task-summary">
      <PlanningExecutionCounts counts={vm.counts} />
      <PlanningExecutionTaskList counts={vm.counts} />
    </div>
  );
}
