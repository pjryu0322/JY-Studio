import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { coalesceCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  buildExecutionUnitVerificationRows,
  type ExecutionUnitVerificationRowV1,
} from "@/lib/prototype/implementationExecutionUnitVerification";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import { loadImplementationExecutionUnitsFromState } from "@/lib/prototype/implementationExecutionUnitStore";
import { ensurePersistedImplementationExecutionUnits } from "@/lib/prototype/implementationExecutionRuntime";
import { buildExecutionUnitsFromLegacyState } from "@/lib/prototype/implementationExecutionUnitBuilder";
import { reconcileImplementationExecutionSelectedUnits } from "@/lib/prototype/implementationExecutionSelectedUnits";
import { type ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import {
  mapSelectedCodeTaskIdsToExecutionUnitIds,
  reconcileSelectedExecutionUnitIds,
} from "@/lib/prototype/implementationExecutionScheduler";
import type { BuildExecutionUnitsAuditV1 } from "@/lib/prototype/implementationExecutionUnitBuilder";
import type { ImplementationCodeTaskSummaryCountsV1 } from "@/lib/prototype/implementationCodeTaskSummary";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  buildImplementationRuntimeSnapshot,
  resolveIntegrationStepsForRuntimeSnapshot,
} from "@/lib/prototype/implementationRuntimeSnapshotBuilder";
import type { ImplementationRuntimeSnapshotV1 } from "@/lib/prototype/implementationRuntimeSnapshot";
import { loadImplementationIntegrationStepsFromState } from "@/lib/prototype/implementationIntegrationStepStore";

export type ImplementationExecutionSummaryCountsV1 = ImplementationCodeTaskSummaryCountsV1 &
  Readonly<{
    readonly executionUnits: readonly ImplementationExecutionUnitV1[];
    readonly selectedExecutionUnitIds: readonly string[];
    readonly unitVerificationRows: readonly ExecutionUnitVerificationRowV1[];
    readonly verificationInconsistentCount: number;
    readonly unitBuildAudit?: BuildExecutionUnitsAuditV1;
    readonly orchestrationPatch?: Partial<RequirementsStateJson>;
    readonly runtimeSnapshot: ImplementationRuntimeSnapshotV1;
  }>;

/**
 * @deprecated Prefer buildImplementationRuntimeSnapshot() / buildImplementationRuntimeSnapshotFromRequirementsState().
 * Compatibility adapter: persists/reconciles units, then derives counts from runtime snapshot only.
 */
export function buildImplementationExecutionSummaryCounts(input: {
  readonly projectId?: string | null;
  readonly requirementsState?: RequirementsStateJson | null;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly selectedCodeTaskIds?: readonly string[] | null;
  readonly legacySelectedTaskIds?: readonly string[] | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly workItemCount?: number;
  readonly previewRuntime?: import("@/lib/prototype/implementationPreviewRuntimeV1").ImplementationPreviewRuntimeV1 | null;
}): ImplementationExecutionSummaryCountsV1 {
  const pid = String(
    input.projectId ??
      input.requirementsState?.implementationExecutionUnitsV1?.projectId ??
      input.codeTaskPlan?.projectId ??
      "",
  ).trim();
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
  let units = persistedOnly.length > 0 ? persistedOnly : (ensured?.units ?? []);
  if (units.length === 0 && input.codeTaskPlan) {
    units = buildExecutionUnitsFromLegacyState({
      projectId: pid || input.codeTaskPlan.projectId,
      codeTaskPlan: input.codeTaskPlan,
      taskList: input.taskList,
      runs: input.runs,
      workItemCount: input.workItemCount,
    }).units;
  }
  const audit = ensured?.audit;
  const orchestrationPatch = ensured?.bootstrapped ? ensured.orchestrationPatch : undefined;

  const legacySelected = input.selectedCodeTaskIds ?? input.legacySelectedTaskIds ?? [];
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
  const codeTaskRuns = coalesceCodeTaskExecutionRunsV1(runsList);
  const mergedState = {
    ...(input.requirementsState ?? {}),
    ...(mergedOrchestrationPatch ?? {}),
    codeTaskExecutionRunsV1: runsList,
  } as RequirementsStateJson;

  const runtimeSnapshot = buildImplementationRuntimeSnapshot({
    projectId: pid || input.codeTaskPlan?.projectId || "unknown",
    executionUnits: units,
    selectedExecutionUnitIds: selectedUnitIds,
    codeTaskRuns,
    integrationSteps: resolveIntegrationStepsForRuntimeSnapshot({
      requirementsState: mergedState,
      codeTaskPlan: input.codeTaskPlan,
    }),
    previewRuntime: input.previewRuntime ?? null,
    codeTaskPlanCount: input.codeTaskPlan?.tasks?.length ?? null,
  });

  const unitVerificationRows = buildExecutionUnitVerificationRows({ units, runs: codeTaskRuns });

  const reconciledCodeTaskIds = selectedUnitIds
    .map((unitId) => units.find((u) => u.unitId === unitId)?.codeTaskId)
    .filter((id): id is string => Boolean(id?.trim()));

  const requestedCodeTaskIds = [...new Set(legacySelected.map((id) => id.trim()).filter(Boolean))];
  const reconciledCodeTaskIdSet = new Set(reconciledCodeTaskIds);
  const removedStaleCodeTaskIds = requestedCodeTaskIds.filter((id) => !reconciledCodeTaskIdSet.has(id));
  const removedStaleSelectedIds = [...new Set([...removedStaleCodeTaskIds, ...removedIds])];
  const summaryCountReconciled = removedStaleSelectedIds.length > 0;

  return {
    totalCodeTaskCount: runtimeSnapshot.codeTask.total,
    selectedCodeTaskCount: runtimeSnapshot.codeTask.selected,
    completedCodeTaskCount: runtimeSnapshot.codeTask.completed,
    reconciledSelectedCodeTaskIds: reconciledCodeTaskIds.length ? reconciledCodeTaskIds : selectedUnitIds,
    removedStaleSelectedIds,
    summaryCountReconciled,
    executionUnits: units,
    selectedExecutionUnitIds: selectedUnitIds,
    unitVerificationRows,
    verificationInconsistentCount: runtimeSnapshot.codeTask.inconsistent,
    unitBuildAudit: audit,
    orchestrationPatch: mergedOrchestrationPatch,
    runtimeSnapshot,
  };
}
