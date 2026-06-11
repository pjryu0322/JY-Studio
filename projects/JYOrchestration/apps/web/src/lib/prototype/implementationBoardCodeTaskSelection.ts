import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  listRunnableCodeTaskIdsFromBoardNodes,
  summarizeCodeTaskBoardRowsFromTreeNodes,
} from "@/lib/prototype/implementationCodeTaskBoardState";
import { buildImplementationExecutionBoardFromRequirementsState } from "@/lib/prototype/implementationExecutionBoard";
import { buildImplementationTaskTreeNodes } from "@/lib/prototype/implementationExecutionBoardPanelView";
import { buildImplementationBoardExecutionContext } from "@/lib/prototype/implementationBoardExecutionContext";
import { normalizeSelectedCodeTaskIds } from "@/lib/prototype/implementationTaskTreeCodeTaskSelection";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ImplementationCodeTaskSelectionSummaryV1 } from "@/lib/prototype/implementationCodeTaskBoardState";

export type ImplementationBoardSelectionBridgeSnapshotV1 = Readonly<{
  readonly liveCheckedCodeTaskIds: readonly string[] | null;
  readonly boardPersistSelection: readonly string[] | null;
  readonly livePanelSummary: ImplementationCodeTaskSelectionSummaryV1 | null;
  /** Runnable ids from the rendered board panel tree (may differ from state-only rebuild). */
  readonly liveRunnableCodeTaskIds: readonly string[] | null;
}>;

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

  const summaryCounts = buildImplementationBoardExecutionContext({
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
 * Panel summary updates in useEffect (one frame after checkbox ref). When live checked ids
 * are coalesced into an override, prefer the view rebuilt from BoardState + those ids.
 */
export function resolveQuickRunSelectionSummaryFromBoardView(input: {
  readonly viewSummary: ImplementationCodeTaskSelectionSummaryV1 | null | undefined;
  readonly livePanelSummary: ImplementationCodeTaskSelectionSummaryV1 | null | undefined;
  readonly hasCheckedSelectionOverride: boolean;
}): ImplementationCodeTaskSelectionSummaryV1 | null {
  const panel = input.livePanelSummary ?? null;
  const view = input.viewSummary ?? null;
  if (input.hasCheckedSelectionOverride) {
    if (panel && panel.selectedRunnableCount > 0) return panel;
    if (view && view.selectedRunnableCount > 0) return view;
    return view ?? panel ?? null;
  }
  return panel ?? view ?? null;
}

/**
 * Toolbar quick-run: intersect live checkbox ids with panel-rendered runnable ids,
 * then fall back to panel summary (full tree context) over state-only rebuild.
 */
export function resolveToolbarQuickRunSelectionSummary(input: {
  readonly checkedCodeTaskIds: readonly string[];
  readonly livePanelSummary: ImplementationCodeTaskSelectionSummaryV1 | null;
  readonly rebuiltSummary: ImplementationCodeTaskSelectionSummaryV1 | null;
  readonly liveRunnableCodeTaskIds: readonly string[] | null;
  readonly rebuiltRunnableCodeTaskIds: readonly string[];
}): ImplementationCodeTaskSelectionSummaryV1 | null {
  const base = input.rebuiltSummary ?? input.livePanelSummary;
  if (!base) return null;

  const runnableIds =
    input.liveRunnableCodeTaskIds && input.liveRunnableCodeTaskIds.length > 0
      ? input.liveRunnableCodeTaskIds
      : input.rebuiltRunnableCodeTaskIds;

  const checked = input.checkedCodeTaskIds.map((id) => id.trim()).filter(Boolean);
  const selectedRunnableFromChecked = checked.filter((id) => runnableIds.includes(id));

  if (selectedRunnableFromChecked.length > 0) {
    return {
      ...base,
      selectedRunnableCount: selectedRunnableFromChecked.length,
      selectedRunnableCodeTaskIds: selectedRunnableFromChecked,
    };
  }

  if (input.livePanelSummary && input.livePanelSummary.selectedRunnableCount > 0) {
    return input.livePanelSummary;
  }

  return input.rebuiltSummary ?? input.livePanelSummary;
}

/**
 * Quick Run / toolbar: BoardState + checkedCodeTaskIds (override) is authoritative for action.
 */
export function resolveImplementationBoardQuickRunSelection(input: {
  readonly projectId: string;
  readonly requirementsState: RequirementsStateJson;
  readonly livePanelSummary?: ImplementationCodeTaskSelectionSummaryV1 | null;
  readonly selectedCodeTaskIdsOverride?: readonly string[] | null;
}): Readonly<{
  readonly view: ImplementationBoardCodeTaskSelectionViewV1 | null;
  readonly summary: ImplementationCodeTaskSelectionSummaryV1 | null;
  readonly selectedRunnableCodeTaskIds: readonly string[];
}> {
  const view = buildImplementationBoardCodeTaskSelectionView({
    projectId: input.projectId,
    requirementsState: input.requirementsState,
    selectedCodeTaskIdsOverride: input.selectedCodeTaskIdsOverride,
  });
  const hasCheckedSelectionOverride =
    input.selectedCodeTaskIdsOverride !== undefined &&
    input.selectedCodeTaskIdsOverride !== null;
  const summary = resolveQuickRunSelectionSummaryFromBoardView({
    viewSummary: view?.summary,
    livePanelSummary: input.livePanelSummary,
    hasCheckedSelectionOverride,
  });
  const selectedRunnableCodeTaskIds = summary?.selectedRunnableCodeTaskIds ?? [];
  return { view, summary, selectedRunnableCodeTaskIds };
}

/** Quick-run gate: board tree summary only (no unit/outcome reconcile). */
export function resolveSelectedRunnableCodeTaskIdsForQuickRun(input: {
  readonly projectId: string;
  readonly requirementsState: RequirementsStateJson;
  readonly livePanelSummary?: ImplementationCodeTaskSelectionSummaryV1 | null;
  readonly liveCheckedCodeTaskIds?: readonly string[] | null;
  readonly liveRunnableCodeTaskIds?: readonly string[] | null;
  readonly boardPersistSelection?: readonly string[] | null;
  readonly selectedCodeTaskIdsOverride?: readonly string[] | null;
}): readonly string[] {
  const override =
    input.selectedCodeTaskIdsOverride ??
    coalesceImplementationBoardLiveSelectedCodeTaskIdsOverride({
      liveCheckedCodeTaskIds: input.liveCheckedCodeTaskIds,
      boardPersistHandlerRef: input.boardPersistSelection,
    });
  const quickRunSelection = resolveImplementationBoardQuickRunSelection({
    projectId: input.projectId,
    requirementsState: input.requirementsState,
    livePanelSummary: input.livePanelSummary,
    selectedCodeTaskIdsOverride: override,
  });
  const checked =
    override !== undefined && override !== null
      ? override
      : (input.liveCheckedCodeTaskIds ?? input.boardPersistSelection ?? []);
  const summary = resolveToolbarQuickRunSelectionSummary({
    checkedCodeTaskIds: checked,
    livePanelSummary: input.livePanelSummary ?? null,
    rebuiltSummary: quickRunSelection.summary,
    liveRunnableCodeTaskIds: input.liveRunnableCodeTaskIds ?? null,
    rebuiltRunnableCodeTaskIds: quickRunSelection.view?.runnableCodeTaskIds ?? [],
  });
  return summary?.selectedRunnableCodeTaskIds ?? [];
}

/** Checkbox / persist selection with live board bridge override (not runnable filter). */
export function resolveCheckedCodeTaskIdsFromBoardBridge(input: {
  readonly bridge: ImplementationBoardSelectionBridgeSnapshotV1;
  readonly requirementsState: RequirementsStateJson;
}): readonly string[] {
  const boardState = input.requirementsState.implementationExecutionBoardStateV1;
  const override = coalesceImplementationBoardLiveSelectedCodeTaskIdsOverride({
    liveCheckedCodeTaskIds: input.bridge.liveCheckedCodeTaskIds,
    boardPersistHandlerRef: input.bridge.boardPersistSelection,
  });
  return normalizeSelectedCodeTaskIds({
    selectedCodeTaskIds:
      override !== undefined && override !== null
        ? override
        : boardState && Object.prototype.hasOwnProperty.call(boardState, "selectedCodeTaskIds")
          ? (boardState.selectedCodeTaskIds ?? [])
          : undefined,
    codeTaskPlan: input.requirementsState.implementationCodeTaskPlanV1,
    legacySelectedTaskIds: boardState?.selectedTaskIds,
  });
}
