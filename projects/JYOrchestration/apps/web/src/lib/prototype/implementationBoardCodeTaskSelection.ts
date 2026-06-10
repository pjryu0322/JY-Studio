import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  listRunnableCodeTaskIdsFromBoardNodes,
  summarizeCodeTaskBoardRowsFromTreeNodes,
} from "@/lib/prototype/implementationCodeTaskBoardState";
import { buildImplementationExecutionBoardFromRequirementsState } from "@/lib/prototype/implementationExecutionBoard";
import { buildImplementationTaskTreeNodes } from "@/lib/prototype/implementationExecutionBoardPanelView";
import { buildImplementationExecutionSummaryCounts } from "@/lib/prototype/implementationExecutionSummary";
import { normalizeSelectedCodeTaskIds } from "@/lib/prototype/implementationTaskTreeCodeTaskSelection";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { CodeTaskBoardSelectionSummaryV1 } from "@/lib/prototype/implementationQuickRunPolicy";

export type ImplementationBoardCodeTaskSelectionViewV1 = Readonly<{
  readonly summary: CodeTaskBoardSelectionSummaryV1;
  readonly selectedCodeTaskIds: readonly string[];
  readonly runnableCodeTaskIds: readonly string[];
}>;

/**
 * Implementation board UX SoT: runnable/selectable CodeTasks are derived only from
 * rendered task-tree nodes (display labels → boardState). Do not use unit/outcome-only
 * helpers for checkbox, toolbar counts, primary actions, or quick-run gates.
 */
export function buildImplementationBoardCodeTaskSelectionView(input: {
  readonly projectId: string;
  readonly requirementsState: RequirementsStateJson;
  /**
   * When set (including `[]`), overrides persisted board selectedCodeTaskIds for tree/summary.
   * Toolbar should pass the latest checkbox selection ref from the board panel.
   */
  readonly selectedCodeTaskIdsOverride?: readonly string[] | null;
}): ImplementationBoardCodeTaskSelectionViewV1 | null {
  const projectId = input.projectId.trim();
  if (!projectId) return null;

  const board = buildImplementationExecutionBoardFromRequirementsState({
    projectId,
    orchestration: input.requirementsState,
  });
  if (!board) return null;

  const codeTaskPlan = input.requirementsState.implementationCodeTaskPlanV1 ?? null;
  const runs = parseCodeTaskExecutionRunsV1(input.requirementsState.codeTaskExecutionRunsV1) ?? [];
  const boardState = input.requirementsState.implementationExecutionBoardStateV1;

  const selectedFromOverride =
    input.selectedCodeTaskIdsOverride !== undefined && input.selectedCodeTaskIdsOverride !== null
      ? input.selectedCodeTaskIdsOverride
      : undefined;
  const selectedFromBoard =
    boardState && Object.prototype.hasOwnProperty.call(boardState, "selectedCodeTaskIds")
      ? (boardState.selectedCodeTaskIds ?? [])
      : undefined;

  const selectedCodeTaskIds = normalizeSelectedCodeTaskIds({
    selectedCodeTaskIds: selectedFromOverride ?? selectedFromBoard,
    codeTaskPlan,
    legacySelectedTaskIds: boardState?.selectedTaskIds,
  });

  const summaryCounts = buildImplementationExecutionSummaryCounts({
    projectId,
    requirementsState: input.requirementsState,
    codeTaskPlan,
    legacySelectedTaskIds: boardState?.selectedTaskIds,
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
    executionUnits: summaryCounts.executionUnits,
    runtimeSnapshotUnits: summaryCounts.runtimeSnapshot.units,
  });

  const summary = summarizeCodeTaskBoardRowsFromTreeNodes({
    nodes,
    selectedCodeTaskIds,
  });

  return {
    summary,
    selectedCodeTaskIds,
    runnableCodeTaskIds: listRunnableCodeTaskIdsFromBoardNodes(nodes),
  };
}

/** @deprecated use buildImplementationBoardCodeTaskSelectionView */
export function listRunnableCodeTaskIdsForImplementationBoardView(input: {
  readonly projectId: string;
  readonly requirementsState: RequirementsStateJson;
  readonly selectedCodeTaskIds?: readonly string[] | null;
}): readonly string[] {
  const view = buildImplementationBoardCodeTaskSelectionView({
    projectId: input.projectId,
    requirementsState: input.requirementsState,
    selectedCodeTaskIdsOverride: input.selectedCodeTaskIds,
  });
  return view?.runnableCodeTaskIds ?? [];
}
