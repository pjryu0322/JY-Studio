import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import {
  filterSelectedRunnableCodeTaskIds,
  listIntegrationReadyCodeTaskIds,
  listUserSelectableRunnableCodeTaskIds,
} from "@/lib/prototype/implementationRunnableCodeTaskSelection";

export type ImplementationCodeTaskUserActionSummaryV1 = Readonly<{
  readonly totalCount: number;
  readonly runnableCount: number;
  readonly selectedCount: number;
  readonly selectedRunnableCount: number;
  readonly integrationReadyCount: number;
  readonly incompleteCount: number;
}>;

/** @deprecated use summarizeImplementationCodeTasksForUserAction */
export type CodeTaskSelectionSummaryV1 = ImplementationCodeTaskUserActionSummaryV1 &
  Readonly<{
    readonly selectableCount: number;
    readonly mode: "execution";
  }>;

export function summarizeImplementationCodeTasksForUserAction(input: {
  readonly codeTasks: readonly ImplementationCodeTaskV1[];
  readonly selectedCodeTaskIds?: readonly string[] | null;
  readonly units?: readonly ImplementationExecutionUnitV1[] | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly progressByCodeTaskId?: ReadonlyMap<string, { readonly statusLabel: string; readonly progressLabel: string }>;
  readonly visibleCodeTaskIds?: readonly string[] | null;
}): ImplementationCodeTaskUserActionSummaryV1 {
  const visible =
    input.visibleCodeTaskIds?.map((id) => id.trim()).filter(Boolean) ??
    input.codeTasks.map((t) => t.codeTaskId.trim()).filter(Boolean);
  const visibleSet = new Set(visible);
  const totalCount = visible.length;

  const runnableIds = listUserSelectableRunnableCodeTaskIds({
    codeTasks: input.codeTasks,
    units: input.units,
    runs: input.runs,
    progressByCodeTaskId: input.progressByCodeTaskId,
    visibleCodeTaskIds: visible,
  });

  const integrationReadyIds = listIntegrationReadyCodeTaskIds({
    codeTasks: input.codeTasks,
    units: input.units,
    runs: input.runs,
    visibleCodeTaskIds: visible,
  });

  const selected = [...new Set((input.selectedCodeTaskIds ?? []).map((id) => id.trim()).filter(Boolean))].filter(
    (id) => visibleSet.has(id),
  );

  const selectedRunnableIds = filterSelectedRunnableCodeTaskIds({
    selectedCodeTaskIds: selected,
    codeTasks: input.codeTasks,
    units: input.units,
    runs: input.runs,
    progressByCodeTaskId: input.progressByCodeTaskId,
  });

  return {
    totalCount,
    runnableCount: runnableIds.length,
    selectedCount: selected.length,
    selectedRunnableCount: selectedRunnableIds.length,
    integrationReadyCount: integrationReadyIds.length,
    incompleteCount: Math.max(0, totalCount - integrationReadyIds.length),
  };
}

export function summarizeSelectableCodeTasks(input: {
  readonly codeTasks: readonly ImplementationCodeTaskV1[];
  readonly selectedCodeTaskIds?: readonly string[] | null;
  readonly units?: readonly ImplementationExecutionUnitV1[] | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly progressByCodeTaskId?: ReadonlyMap<string, { readonly statusLabel: string; readonly progressLabel: string }>;
  readonly visibleCodeTaskIds?: readonly string[] | null;
}): CodeTaskSelectionSummaryV1 {
  const summary = summarizeImplementationCodeTasksForUserAction(input);
  return {
    ...summary,
    selectableCount: summary.runnableCount,
    mode: "execution",
  };
}

export function logCodeTaskSelectionSummaryResolved(input: {
  readonly projectId?: string | null;
  readonly summary: ImplementationCodeTaskUserActionSummaryV1;
}): void {
  console.info(
    JSON.stringify({
      action: "runnable_codetask_selection_summary_resolved",
      projectId: input.projectId ?? null,
      totalCount: input.summary.totalCount,
      runnableCount: input.summary.runnableCount,
      selectedCount: input.summary.selectedCount,
      selectedRunnableCount: input.summary.selectedRunnableCount,
      integrationReadyCount: input.summary.integrationReadyCount,
      incompleteCount: input.summary.incompleteCount,
    }),
  );
}

export function logRunnableCodeTaskSelectionBlocked(input: {
  readonly codeTaskId: string;
  readonly statusLabel?: string | null;
  readonly progressLabel?: string | null;
  readonly reason: string;
}): void {
  console.info(
    JSON.stringify({
      action: "runnable_codetask_selection_blocked",
      codeTaskId: input.codeTaskId,
      statusLabel: input.statusLabel ?? null,
      progressLabel: input.progressLabel ?? null,
      reason: input.reason,
    }),
  );
}

export { resolveUserRunnableCodeTaskSelectionState, resolveCodeTaskDisplayLabelsForUserSelection };
