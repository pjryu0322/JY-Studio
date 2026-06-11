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
import type { ImplementationCodeTaskSelectionSummaryV1 } from "@/lib/prototype/implementationCodeTaskBoardState";

export type ImplementationBoardCodeTaskSelectionViewV1 = Readonly<{
  readonly summary: ImplementationCodeTaskSelectionSummaryV1;
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
    checkedCodeTaskIds: selectedCodeTaskIds,
  });

  return {
    summary,
    selectedCodeTaskIds,
    runnableCodeTaskIds: listRunnableCodeTaskIdsFromBoardNodes(nodes),
  };
}

/** Panel local checkbox ids beat persist-handler ref (toolbar quick run). */
export function coalesceImplementationBoardLiveSelectedCodeTaskIdsOverride(input: {
  readonly liveCheckedCodeTaskIds?: readonly string[] | null;
  readonly boardPersistHandlerRef?: readonly string[] | null;
}): readonly string[] | null | undefined {
  if (input.liveCheckedCodeTaskIds !== undefined && input.liveCheckedCodeTaskIds !== null) {
    return input.liveCheckedCodeTaskIds;
  }
  return input.boardPersistHandlerRef;
}

/**
 * Quick Run / toolbar: prefer panel-rendered summary (header counts), else rebuilt view.
 */
export function resolveImplementationBoardQuickRunSelection(input: {
  readonly projectId: string;
  readonly requirementsState: RequirementsStateJson;
  readonly livePanelSummary?: ImplementationCodeTaskSelectionSummaryV1 | null;
  readonly selectedCodeTaskIdsOverride?: readonly string[] | null;
}): Readonly<{
  readonly view: ImplementationBoardCodeTaskSelectionViewV1 | null;
  readonly summary: CodeTaskBoardSelectionSummaryV1 | null;
  readonly selectedRunnableCodeTaskIds: readonly string[];
}> {
  const view = buildImplementationBoardCodeTaskSelectionView({
    projectId: input.projectId,
    requirementsState: input.requirementsState,
    selectedCodeTaskIdsOverride: input.selectedCodeTaskIdsOverride,
  });
  const summary = input.livePanelSummary ?? view?.summary ?? null;
  const selectedRunnableCodeTaskIds = summary?.selectedRunnableCodeTaskIds ?? [];
  return { view, summary, selectedRunnableCodeTaskIds };
}
