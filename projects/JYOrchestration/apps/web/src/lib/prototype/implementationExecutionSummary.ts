import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import {
  ensurePersistedImplementationExecutionUnits,
  loadImplementationExecutionUnitsFromState,
} from "@/lib/prototype/implementationExecutionUnitStore";
import {
  isExecutionUnitTerminalForQueue,
  type ImplementationExecutionUnitV1,
} from "@/lib/prototype/implementationExecutionUnit";
import {
  mapSelectedCodeTaskIdsToExecutionUnitIds,
  reconcileSelectedExecutionUnitIds,
} from "@/lib/prototype/implementationExecutionScheduler";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

import {
  buildExecutionUnitsFromLegacyState,
  type BuildExecutionUnitsAuditV1,
} from "@/lib/prototype/implementationExecutionUnitBuilder";
import type { ImplementationCodeTaskSummaryCountsV1 } from "@/lib/prototype/implementationCodeTaskSummary";

export type ImplementationExecutionSummaryCountsV1 = ImplementationCodeTaskSummaryCountsV1 &
  Readonly<{
    readonly executionUnits: readonly ImplementationExecutionUnitV1[];
    readonly selectedExecutionUnitIds: readonly string[];
    readonly unitBuildAudit?: BuildExecutionUnitsAuditV1;
    readonly orchestrationPatch?: Partial<RequirementsStateJson>;
  }>;

export function buildImplementationExecutionSummaryCounts(input: {
  readonly projectId?: string | null;
  readonly requirementsState?: RequirementsStateJson | null;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly selectedCodeTaskIds?: readonly string[] | null;
  readonly legacySelectedTaskIds?: readonly string[] | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly workItemCount?: number;
}): ImplementationExecutionSummaryCountsV1 {
  const pid = String(input.projectId ?? input.requirementsState?.implementationExecutionUnitsV1?.projectId ?? "").trim();
  const ensured = pid
    ? ensurePersistedImplementationExecutionUnits({
        projectId: pid,
        requirementsState: input.requirementsState,
        codeTaskPlan: input.codeTaskPlan,
        taskList: input.taskList,
        runs: input.runs,
        workItemCount: input.workItemCount,
      })
    : null;
  const persistedOnly = loadImplementationExecutionUnitsFromState(input.requirementsState);
  let units =
    persistedOnly.length > 0
      ? persistedOnly
      : (ensured?.units ?? []);
  let audit = ensured?.audit;
  const orchestrationPatch = ensured?.bootstrapped ? ensured.orchestrationPatch : undefined;

  if (!units.length) {
    const built = buildExecutionUnitsFromLegacyState({
      codeTaskPlan: input.codeTaskPlan,
      taskList: input.taskList,
      runs: input.runs,
      workItemCount: input.workItemCount,
    });
    units = built.units;
    audit = built.audit;
  }

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
    orchestrationPatch,
  };
}
