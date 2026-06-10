import type { summarizeCodeTaskBoardRowsFromTreeNodes } from "@/lib/prototype/implementationCodeTaskBoardState";

export type CodeTaskBoardSelectionSummaryV1 = ReturnType<
  typeof summarizeCodeTaskBoardRowsFromTreeNodes
>;

export type QuickRunToolbarResolvedActionV1 =
  | Readonly<{
      readonly action: "execute_selected_runnable_codetasks";
      readonly codeTaskIds: readonly string[];
    }>
  | Readonly<{
      readonly action: "blocked_no_selection";
      readonly message: string;
    }>
  | Readonly<{
      readonly action: "prepare_integration_preview";
      readonly codeTaskIds: readonly string[];
    }>;

const NO_SELECTION_MESSAGE = "실행할 CodeTask를 선택해 주세요." as const;

/**
 * Toolbar Quick Run / lightning: board checkbox selection SoT (summary.selectedRunnableCodeTaskIds).
 */
export function resolveQuickRunToolbarAction(input: {
  readonly summary: CodeTaskBoardSelectionSummaryV1;
}): QuickRunToolbarResolvedActionV1 {
  const summary = input.summary;
  if (summary.selectedRunnableCodeTaskIds.length > 0) {
    return {
      action: "execute_selected_runnable_codetasks",
      codeTaskIds: summary.selectedRunnableCodeTaskIds,
    };
  }
  if (summary.runnableCount > 0) {
    return {
      action: "blocked_no_selection",
      message: NO_SELECTION_MESSAGE,
    };
  }
  if (summary.integrationReadyCount > 0) {
    return {
      action: "prepare_integration_preview",
      codeTaskIds: summary.integrationReadyCodeTaskIds,
    };
  }
  return {
    action: "blocked_no_selection",
    message: NO_SELECTION_MESSAGE,
  };
}

export function formatQuickRunToolbarTraceDetail(input: {
  readonly boardRows: number;
  readonly summary: CodeTaskBoardSelectionSummaryV1;
  readonly resolvedAction: QuickRunToolbarResolvedActionV1["action"];
}): string {
  return [
    `boardRows=${input.boardRows}`,
    `runnableCount=${input.summary.runnableCount}`,
    `selectedRunnableCount=${input.summary.selectedRunnableCount}`,
    `selectedRunnableCodeTaskIds=${input.summary.selectedRunnableCodeTaskIds.join(",") || "none"}`,
    `integrationReadyCount=${input.summary.integrationReadyCount}`,
    `resolvedAction=${input.resolvedAction}`,
  ].join(" ");
}
