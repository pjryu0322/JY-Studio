import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { findLatestRunForCodeTask, type CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  buildExecutionUnitVerificationRows,
  isExecutionUnitCompletedForSummary,
  isExecutionUnitSkippedForSummary,
  type ExecutionUnitVerificationRowV1,
} from "@/lib/prototype/implementationExecutionUnitVerification";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import {
  loadImplementationExecutionUnitsFromState,
} from "@/lib/prototype/implementationExecutionUnitStore";
import { ensurePersistedImplementationExecutionUnits } from "@/lib/prototype/implementationExecutionRuntime";
import { reconcileImplementationExecutionSelectedUnits } from "@/lib/prototype/implementationExecutionSelectedUnits";
import {
  type ImplementationExecutionUnitV1,
} from "@/lib/prototype/implementationExecutionUnit";
import {
  mapSelectedCodeTaskIdsToExecutionUnitIds,
  reconcileSelectedExecutionUnitIds,
} from "@/lib/prototype/implementationExecutionScheduler";
import type { BuildExecutionUnitsAuditV1 } from "@/lib/prototype/implementationExecutionUnitBuilder";
import type { ImplementationCodeTaskSummaryCountsV1 } from "@/lib/prototype/implementationCodeTaskSummary";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export type ImplementationExecutionSummaryCountsV1 = ImplementationCodeTaskSummaryCountsV1 &
  Readonly<{
    readonly executionUnits: readonly ImplementationExecutionUnitV1[];
    readonly selectedExecutionUnitIds: readonly string[];
    readonly unitVerificationRows: readonly ExecutionUnitVerificationRowV1[];
    readonly verificationInconsistentCount: number;
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

  const legacySelected =
    input.selectedCodeTaskIds ?? input.legacySelectedTaskIds ?? [];
  const selection =
    pid && input.requirementsState
      ? reconcileImplementationExecutionSelectedUnits({
          projectId: pid,
          state: {
            ...input.requirementsState,
            ...(orchestrationPatch ?? {}),
          },
          units,
          legacySelectedCodeTaskIds: legacySelected,
        })
      : null;

  const rawSelected = selection
    ? selection.selectedUnitIds
    : mapSelectedCodeTaskIdsToExecutionUnitIds(legacySelected, units);
  const { selectedUnitIds, removedIds } = selection
    ? { selectedUnitIds: selection.selectedUnitIds, removedIds: [] as string[] }
    : reconcileSelectedExecutionUnitIds({
        selectedUnitIds: rawSelected.length ? rawSelected : units.map((u) => u.unitId),
        units,
      });

  const mergedOrchestrationPatch =
    orchestrationPatch || selection?.orchestrationPatch
      ? {
          ...(orchestrationPatch ?? {}),
          ...(selection?.orchestrationPatch ?? {}),
        }
      : undefined;

  const runsList = input.runs ?? input.requirementsState?.codeTaskExecutionRunsV1 ?? [];
  const unitVerificationRows = buildExecutionUnitVerificationRows({ units, runs: runsList });
  const verificationInconsistentCount = unitVerificationRows.filter(
    (r) => r.displayStatus === "verification_inconsistent",
  ).length;

  const totalCodeTaskCount = units.length;
  const selectedCodeTaskCount = selectedUnitIds.length;
  const selectedSet = new Set(selectedUnitIds);

  let completedCodeTaskCount = 0;
  for (const unit of units) {
    if (!selectedSet.has(unit.unitId)) continue;
    const run = findLatestRunForCodeTask(runsList, unit.codeTaskId);
    if (isExecutionUnitCompletedForSummary({ unit, run })) completedCodeTaskCount += 1;
    else if (isExecutionUnitSkippedForSummary({ unit, run })) completedCodeTaskCount += 1;
  }

  if (!selectedUnitIds.length) {
    completedCodeTaskCount = units.filter((u) => {
      const run = findLatestRunForCodeTask(runsList, u.codeTaskId);
      return (
        isExecutionUnitCompletedForSummary({ unit: u, run }) ||
        isExecutionUnitSkippedForSummary({ unit: u, run })
      );
    }).length;
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
    unitVerificationRows,
    verificationInconsistentCount,
    unitBuildAudit: audit,
    orchestrationPatch: mergedOrchestrationPatch,
  };
}
