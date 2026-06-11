import {
  coalesceImplementationBoardLiveSelectedCodeTaskIdsOverride,
  resolveImplementationBoardQuickRunSelection,
  resolveToolbarQuickRunSelectionSummary,
  type ImplementationBoardSelectionBridgeSnapshotV1,
} from "@/lib/prototype/implementationBoardCodeTaskSelection";
import {
  formatQuickRunToolbarTraceDetail,
  resolveQuickRunToolbarAction,
  type QuickRunToolbarResolvedActionV1,
} from "@/lib/prototype/implementationQuickRunPolicy";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export type ImplementationToolbarQuickRunEvaluationV1 =
  | Readonly<{ readonly outcome: "not_board_ready" }>
  | Readonly<{
      readonly outcome: "blocked";
      readonly message: string;
      readonly traceDetail: string;
      readonly selectedRunnableCount: number;
      readonly resolvedAction: QuickRunToolbarResolvedActionV1["action"];
    }>
  | Readonly<{
      readonly outcome: "execute_selected_runnable_codetasks";
      readonly codeTaskIds: readonly string[];
      readonly traceDetail: string;
      readonly selectedRunnableCount: number;
    }>
  | Readonly<{
      readonly outcome: "prepare_integration_preview";
      readonly traceDetail: string;
      readonly selectedRunnableCount: number;
    }>
  | Readonly<{
      readonly outcome: "open_preview";
      readonly traceDetail: string;
    }>;

export function evaluateImplementationToolbarQuickRun(input: {
  readonly projectId: string;
  readonly requirementsState: RequirementsStateJson;
  readonly boardTaskRowCount: number;
  readonly bridge: ImplementationBoardSelectionBridgeSnapshotV1;
}): ImplementationToolbarQuickRunEvaluationV1 {
  const pid = input.projectId.trim();
  if (!pid || !input.boardTaskRowCount) {
    return { outcome: "not_board_ready" };
  }

  const selectionOverride = coalesceImplementationBoardLiveSelectedCodeTaskIdsOverride({
    liveCheckedCodeTaskIds: input.bridge.liveCheckedCodeTaskIds,
    boardPersistHandlerRef: input.bridge.boardPersistSelection,
  });

  const quickRunSelection = resolveImplementationBoardQuickRunSelection({
    projectId: pid,
    requirementsState: input.requirementsState,
    livePanelSummary: input.bridge.livePanelSummary,
    selectedCodeTaskIdsOverride: selectionOverride,
  });

  const checkedForTrace =
    input.bridge.liveCheckedCodeTaskIds ?? input.bridge.boardPersistSelection ?? [];
  const summary = resolveToolbarQuickRunSelectionSummary({
    checkedCodeTaskIds: checkedForTrace,
    livePanelSummary: input.bridge.livePanelSummary,
    rebuiltSummary: quickRunSelection.summary,
    liveRunnableCodeTaskIds: input.bridge.liveRunnableCodeTaskIds,
    rebuiltRunnableCodeTaskIds: quickRunSelection.view?.runnableCodeTaskIds ?? [],
  });
  if (!summary) {
    return { outcome: "not_board_ready" };
  }

  const resolved = resolveQuickRunToolbarAction({ summary });
  const traceDetail = formatQuickRunToolbarTraceDetail({
    boardRows: input.boardTaskRowCount,
    summary,
    resolvedAction: resolved.action,
    checkedCodeTaskIds: checkedForTrace,
  });

  if (resolved.action === "blocked_no_selection" || resolved.action === "blocked_no_available_action") {
    return {
      outcome: "blocked",
      message: resolved.message,
      traceDetail,
      selectedRunnableCount: summary.selectedRunnableCount,
      resolvedAction: resolved.action,
    };
  }

  if (resolved.action === "prepare_integration_preview") {
    return {
      outcome: "prepare_integration_preview",
      traceDetail,
      selectedRunnableCount: summary.selectedRunnableCount,
    };
  }

  if (resolved.action === "open_preview") {
    return { outcome: "open_preview", traceDetail };
  }

  return {
    outcome: "execute_selected_runnable_codetasks",
    codeTaskIds: resolved.codeTaskIds,
    traceDetail,
    selectedRunnableCount: summary.selectedRunnableCount,
  };
}
