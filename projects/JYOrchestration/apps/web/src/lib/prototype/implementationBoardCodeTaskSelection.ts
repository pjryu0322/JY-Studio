import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { listRunnableCodeTaskIdsFromBoardNodes } from "@/lib/prototype/implementationCodeTaskBoardState";
import { buildImplementationExecutionBoardFromRequirementsState } from "@/lib/prototype/implementationExecutionBoard";
import { buildImplementationTaskTreeNodes } from "@/lib/prototype/implementationExecutionBoardPanelView";
import { buildImplementationExecutionSummaryCounts } from "@/lib/prototype/implementationExecutionSummary";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

/**
 * Implementation board UX SoT: runnable/selectable CodeTasks are derived only from
 * rendered task-tree nodes (display labels → boardState). Do not use unit/outcome-only
 * helpers for checkbox, toolbar counts, primary actions, or quick-run gates.
 */
export function listRunnableCodeTaskIdsForImplementationBoardView(input: {
  readonly projectId: string;
  readonly requirementsState: RequirementsStateJson;
  readonly selectedCodeTaskIds?: readonly string[] | null;
}): readonly string[] {
  const projectId = input.projectId.trim();
  if (!projectId) return [];

  const board = buildImplementationExecutionBoardFromRequirementsState({
    projectId,
    orchestration: input.requirementsState,
  });
  if (!board) return [];

  const codeTaskPlan = input.requirementsState.implementationCodeTaskPlanV1 ?? null;
  const runs = parseCodeTaskExecutionRunsV1(input.requirementsState.codeTaskExecutionRunsV1) ?? [];
  const selectedCodeTaskIds =
    input.selectedCodeTaskIds ??
    input.requirementsState.implementationExecutionBoardStateV1?.selectedCodeTaskIds ??
    null;

  const summary = buildImplementationExecutionSummaryCounts({
    projectId,
    requirementsState: input.requirementsState,
    codeTaskPlan,
    selectedCodeTaskIds,
    legacySelectedTaskIds:
      input.requirementsState.implementationExecutionBoardStateV1?.selectedTaskIds,
    runs,
  });

  const nodes = buildImplementationTaskTreeNodes({
    board,
    codeTaskPlan,
    cursorWorkItems: input.requirementsState.cursorWorkItemsV1 ?? null,
    codeTaskExecutionRuns: runs,
    checkedCodeTaskIds: selectedCodeTaskIds,
    taskCursorExecution: input.requirementsState.taskCursorExecutionV1 ?? null,
    taskCursorExecutionHistory: input.requirementsState.taskCursorExecutionHistoryV1 ?? null,
    implementationAutoQualityGateV1: input.requirementsState.implementationAutoQualityGateV1 ?? null,
    executionUnits: summary.executionUnits,
    runtimeSnapshotUnits: summary.runtimeSnapshot.units,
  });

  return listRunnableCodeTaskIdsFromBoardNodes(nodes);
}
