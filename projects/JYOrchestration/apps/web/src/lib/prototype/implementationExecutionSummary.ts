import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import {
  buildExecutionUnitsFromLegacyState,
  type BuildExecutionUnitsAuditV1,
} from "@/lib/prototype/implementationExecutionUnitBuilder";
import {
  isExecutionUnitTerminalForQueue,
  type ImplementationExecutionUnitV1,
} from "@/lib/prototype/implementationExecutionUnit";
import {
  mapSelectedCodeTaskIdsToExecutionUnitIds,
  reconcileSelectedExecutionUnitIds,
} from "@/lib/prototype/implementationExecutionScheduler";
import type { ImplementationCodeTaskSummaryCountsV1 } from "@/lib/prototype/implementationCodeTaskSummary";

export type ImplementationExecutionSummaryCountsV1 = ImplementationCodeTaskSummaryCountsV1 &
  Readonly<{
    readonly executionUnits: readonly ImplementationExecutionUnitV1[];
    readonly selectedExecutionUnitIds: readonly string[];
    readonly unitBuildAudit: BuildExecutionUnitsAuditV1;
  }>;

export function buildImplementationExecutionSummaryCounts(input: {
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly selectedCodeTaskIds?: readonly string[] | null;
  readonly legacySelectedTaskIds?: readonly string[] | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly workItemCount?: number;
}): ImplementationExecutionSummaryCountsV1 {
  const { units, audit } = buildExecutionUnitsFromLegacyState({
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    runs: input.runs,
    workItemCount: input.workItemCount,
  });

  const rawSelected = mapSelectedCodeTaskIdsToExecutionUnitIds(
    input.selectedCodeTaskIds ?? input.legacySelectedTaskIds ?? [],
  );
  const { selectedUnitIds, removedIds } = reconcileSelectedExecutionUnitIds({
    selectedUnitIds: rawSelected.length ? rawSelected : units.map((u) => u.unitId),
    units,
  });

  const totalCodeTaskCount = units.length;
  const selectedCodeTaskCount = selectedUnitIds.length;
  const selectedSet = new Set(selectedUnitIds);

  let completedCodeTaskCount = 0;
  for (const unit of units) {
    if (!selectedSet.has(unit.unitId)) continue;
    if (isExecutionUnitTerminalForQueue(unit.status)) completedCodeTaskCount += 1;
  }

  if (!selectedUnitIds.length) {
    completedCodeTaskCount = units.filter((u) => isExecutionUnitTerminalForQueue(u.status)).length;
  }

  const summaryCountReconciled = removedIds.length > 0;

  return {
    totalCodeTaskCount,
    selectedCodeTaskCount,
    completedCodeTaskCount,
    reconciledSelectedCodeTaskIds: selectedUnitIds,
    removedStaleSelectedIds: removedIds,
    summaryCountReconciled,
    executionUnits: units,
    selectedExecutionUnitIds: selectedUnitIds,
    unitBuildAudit: audit,
  };
}
