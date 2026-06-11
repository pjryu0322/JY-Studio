import type { ImplementationCodeTaskSelectionSummaryV1 } from "@/lib/prototype/implementationCodeTaskBoardState";

export type ImplementationPrimaryActionV1 =
  | "execute_selected_runnable_codetasks"
  | "prepare_integration_preview"
  | "open_preview"
  | "blocked_no_selection"
  | "blocked_no_available_action";

export type ImplementationPrimaryActionResolutionV1 = Readonly<{
  readonly action: ImplementationPrimaryActionV1;
  readonly label: string;
  readonly enabled: boolean;
  readonly codeTaskIds: readonly string[];
  readonly disabledReason: string | null;
}>;

const NO_SELECTION_MESSAGE = "실행할 CodeTask를 선택해 주세요." as const;
const NO_AVAILABLE_MESSAGE = "실행하거나 통합할 CodeTask가 없습니다." as const;

/**
 * Toolbar Quick Run, board footer, and runtime dispatch share this policy.
 * Input must come from BoardState + checkedCodeTaskIds summary only.
 */
export function resolveImplementationPrimaryAction(input: {
  readonly selectionSummary: ImplementationCodeTaskSelectionSummaryV1;
  readonly previewReady?: boolean;
  readonly actualPreviewUrl?: string | null;
}): ImplementationPrimaryActionResolutionV1 {
  const summary = input.selectionSummary;
  const previewReady = input.previewReady === true;
  const previewUrl = String(input.actualPreviewUrl ?? "").trim();

  if (summary.selectedRunnableCodeTaskIds.length > 0) {
    const resolution: ImplementationPrimaryActionResolutionV1 = {
      action: "execute_selected_runnable_codetasks",
      label: "선택 작업 실행",
      enabled: true,
      codeTaskIds: summary.selectedRunnableCodeTaskIds,
      disabledReason: null,
    };
    logImplementationPrimaryActionResolved(summary, resolution);
    return resolution;
  }

  if (summary.runnableCount > 0) {
    const resolution: ImplementationPrimaryActionResolutionV1 = {
      action: "blocked_no_selection",
      label: "선택 작업 실행",
      enabled: false,
      codeTaskIds: [],
      disabledReason: NO_SELECTION_MESSAGE,
    };
    logImplementationPrimaryActionResolved(summary, resolution);
    return resolution;
  }

  if (previewReady && previewUrl) {
    const resolution: ImplementationPrimaryActionResolutionV1 = {
      action: "open_preview",
      label: "Preview 보기",
      enabled: true,
      codeTaskIds: [],
      disabledReason: null,
    };
    logImplementationPrimaryActionResolved(summary, resolution);
    return resolution;
  }

  if (summary.integrationReadyCodeTaskIds.length > 0) {
    const resolution: ImplementationPrimaryActionResolutionV1 = {
      action: "prepare_integration_preview",
      label: "통합 및 Preview 준비",
      enabled: true,
      codeTaskIds: summary.integrationReadyCodeTaskIds,
      disabledReason: null,
    };
    logImplementationPrimaryActionResolved(summary, resolution);
    return resolution;
  }

  const resolution: ImplementationPrimaryActionResolutionV1 = {
    action: "blocked_no_available_action",
    label: "실행 가능한 작업 없음",
    enabled: false,
    codeTaskIds: [],
    disabledReason: NO_AVAILABLE_MESSAGE,
  };
  logImplementationPrimaryActionResolved(summary, resolution);
  return resolution;
}

function logImplementationPrimaryActionResolved(
  summary: ImplementationCodeTaskSelectionSummaryV1,
  resolution: ImplementationPrimaryActionResolutionV1,
): void {
  if (typeof console === "undefined" || !console.info) return;
  console.info(
    JSON.stringify({
      action: "implementation_primary_action_resolved",
      resolvedAction: resolution.action,
      enabled: resolution.enabled,
      runnableCount: summary.runnableCount,
      selectedRunnableCount: summary.selectedRunnableCount,
      selectedRunnableCodeTaskIds: summary.selectedRunnableCodeTaskIds,
      integrationReadyCount: summary.integrationReadyCount,
      boardExecuteButton: false,
    }),
  );
}
