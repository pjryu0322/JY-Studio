import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import {
  filterCodeTaskIdsForSelectionMode,
  type CodeTaskSelectionModeV1,
} from "@/lib/prototype/implementationCodeTaskSelectionPolicy";
import { resolveCodeTaskSelectionMode } from "@/lib/prototype/implementationSelectionModeResolver";

export type CodeTaskSelectionSummaryV1 = Readonly<{
  readonly totalCount: number;
  readonly selectableCount: number;
  readonly selectedCount: number;
  readonly runnableCount: number;
  readonly integrationReadyCount: number;
  readonly mode: CodeTaskSelectionModeV1;
}>;

export function summarizeSelectableCodeTasks(input: {
  readonly codeTasks: readonly ImplementationCodeTaskV1[];
  readonly selectedCodeTaskIds?: readonly string[] | null;
  readonly mode?: CodeTaskSelectionModeV1;
  readonly units?: readonly ImplementationExecutionUnitV1[] | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly progressByCodeTaskId?: ReadonlyMap<string, { readonly statusLabel: string; readonly progressLabel: string }>;
  readonly visibleCodeTaskIds?: readonly string[] | null;
}): CodeTaskSelectionSummaryV1 {
  const mode =
    input.mode ??
    resolveCodeTaskSelectionMode({
      surface: "task_tree",
    });
  const visible =
    input.visibleCodeTaskIds?.map((id) => id.trim()).filter(Boolean) ??
    input.codeTasks.map((t) => t.codeTaskId.trim()).filter(Boolean);
  const visibleSet = new Set(visible);
  const totalCount = visible.length;

  const executionSelectable = filterCodeTaskIdsForSelectionMode({
    codeTaskIds: input.codeTasks.map((t) => t.codeTaskId),
    mode: "execution",
    codeTasks: input.codeTasks,
    units: input.units,
    runs: input.runs,
    progressByCodeTaskId: input.progressByCodeTaskId,
  }).filter((id) => visibleSet.has(id));

  const modeSelectable = filterCodeTaskIdsForSelectionMode({
    codeTaskIds: input.codeTasks.map((t) => t.codeTaskId),
    mode,
    codeTasks: input.codeTasks,
    units: input.units,
    runs: input.runs,
    progressByCodeTaskId: input.progressByCodeTaskId,
  }).filter((id) => visibleSet.has(id));

  const integrationReady = filterCodeTaskIdsForSelectionMode({
    codeTaskIds: input.codeTasks.map((t) => t.codeTaskId),
    mode: "integration",
    codeTasks: input.codeTasks,
    units: input.units,
    runs: input.runs,
    progressByCodeTaskId: input.progressByCodeTaskId,
  }).filter((id) => visibleSet.has(id));

  const selected = [...new Set((input.selectedCodeTaskIds ?? []).map((id) => id.trim()).filter(Boolean))].filter(
    (id) => visibleSet.has(id),
  );

  return {
    totalCount,
    selectableCount: modeSelectable.length,
    selectedCount: selected.length,
    runnableCount: executionSelectable.length,
    integrationReadyCount: integrationReady.length,
    mode,
  };
}

export function logCodeTaskSelectionSummaryResolved(input: {
  readonly projectId?: string | null;
  readonly summary: CodeTaskSelectionSummaryV1;
}): void {
  console.info(
    JSON.stringify({
      action: "codetask_selection_summary_resolved",
      projectId: input.projectId ?? null,
      mode: input.summary.mode,
      totalCount: input.summary.totalCount,
      selectableCount: input.summary.selectableCount,
      selectedCount: input.summary.selectedCount,
      runnableCount: input.summary.runnableCount,
      integrationReadyCount: input.summary.integrationReadyCount,
    }),
  );
}
