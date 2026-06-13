import type { ImplementationCodeTaskSelectionSummaryV1 } from "@/lib/prototype/implementationCodeTaskBoardState";
import {
  resolveImplementationPrimaryAction,
  type ImplementationPrimaryActionV1,
} from "@/lib/prototype/implementationActionRoutingPolicy";

export type QuickRunToolbarResolvedActionV1 =
  | Readonly<{
      readonly action: "execute_selected_runnable_codetasks";
      readonly codeTaskIds: readonly string[];
    }>
  | Readonly<{
      readonly action: "blocked_no_selection" | "blocked_no_available_action";
      readonly message: string;
    }>
  | Readonly<{
      readonly action: "prepare_integration_preview";
      readonly codeTaskIds: readonly string[];
    }>
  | Readonly<{
      readonly action: "open_preview";
      readonly codeTaskIds: readonly string[];
    }>;

export function resolveQuickRunToolbarAction(input: {
  readonly summary: ImplementationCodeTaskSelectionSummaryV1;
  readonly previewReady?: boolean;
  readonly actualPreviewUrl?: string | null;
}): QuickRunToolbarResolvedActionV1 {
  const routed = resolveImplementationPrimaryAction({
    selectionSummary: input.summary,
    previewReady: input.previewReady,
    actualPreviewUrl: input.actualPreviewUrl,
  });
  return mapPrimaryActionToQuickRunResolved(routed.action, routed);
}

function mapPrimaryActionToQuickRunResolved(
  action: ImplementationPrimaryActionV1,
  routed: ReturnType<typeof resolveImplementationPrimaryAction>,
): QuickRunToolbarResolvedActionV1 {
  switch (action) {
    case "execute_selected_runnable_codetasks":
      return { action, codeTaskIds: routed.codeTaskIds };
    case "prepare_integration_preview":
      if (!routed.enabled) {
        return {
          action: "blocked_no_available_action",
          message: routed.disabledReason ?? "통합을 실행할 수 없습니다.",
        };
      }
      return { action, codeTaskIds: routed.codeTaskIds };
    case "open_preview":
      return { action, codeTaskIds: [] };
    case "blocked_no_selection":
    case "blocked_no_available_action":
      return {
        action,
        message: routed.disabledReason ?? "실행할 CodeTask를 선택해 주세요.",
      };
    default:
      return { action: "blocked_no_available_action", message: routed.disabledReason ?? "" };
  }
}

export function formatQuickRunToolbarTraceDetail(input: {
  readonly boardRows: number;
  readonly summary: ImplementationCodeTaskSelectionSummaryV1;
  readonly resolvedAction: QuickRunToolbarResolvedActionV1["action"];
  readonly checkedCodeTaskIds?: readonly string[];
}): string {
  const checkedPart =
    input.checkedCodeTaskIds !== undefined
      ? `checkedCodeTaskIds=${input.checkedCodeTaskIds.join(",") || "none"}`
      : "";
  return [
    `boardRows=${input.boardRows}`,
    checkedPart,
    `runnableCount=${input.summary.runnableCount}`,
    `selectedRunnableCount=${input.summary.selectedRunnableCount}`,
    `selectedRunnableCodeTaskIds=${input.summary.selectedRunnableCodeTaskIds.join(",") || "none"}`,
    `integrationReadyCount=${input.summary.integrationReadyCount}`,
    `integrationReadyCodeTaskIds=${input.summary.integrationReadyCodeTaskIds.join(",") || "none"}`,
    `resolvedAction=${input.resolvedAction}`,
  ]
    .filter(Boolean)
    .join(" ");
}
