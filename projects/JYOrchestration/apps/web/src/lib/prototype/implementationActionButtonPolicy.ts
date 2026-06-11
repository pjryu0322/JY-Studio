import type { ImplementationCodeTaskSelectionSummaryV1 } from "@/lib/prototype/implementationCodeTaskBoardState";
import { resolveImplementationPrimaryAction } from "@/lib/prototype/implementationActionRoutingPolicy";
import type { ImplementationCodeTaskUserActionSummaryV1 } from "@/lib/prototype/implementationCodeTaskSelectionSummary";

export type ImplementationBoardPrimaryActionKindV1 =
  | "prepare_integration_preview"
  | "open_preview"
  | null;

export type ImplementationBoardPrimaryActionStateV1 = Readonly<{
  readonly primaryAction: ImplementationBoardPrimaryActionKindV1;
  readonly primaryLabel: string | null;
  readonly primaryEnabled: boolean;
  readonly primaryDisabledTitle: string | null;
  readonly showIntegrationPrepareButton: boolean;
  /** Execution uses implementation stage toolbar Quick Run only — never a board button. */
  readonly showExecuteSelectedButton: boolean;
  readonly showReworkSelectedButton: boolean;
}>;

function toBoardSelectionSummary(
  summary: ImplementationCodeTaskUserActionSummaryV1 & {
    readonly selectedRunnableCodeTaskIds?: readonly string[];
    readonly integrationReadyCodeTaskIds?: readonly string[];
  },
): ImplementationCodeTaskSelectionSummaryV1 {
  return {
    totalCount: summary.totalCount,
    runnableCount: summary.runnableCount,
    selectedRunnableCount: summary.selectedRunnableCount,
    selectedRunnableCodeTaskIds: summary.selectedRunnableCodeTaskIds ?? [],
    integrationReadyCount: summary.integrationReadyCount,
    integrationReadyCodeTaskIds: summary.integrationReadyCodeTaskIds ?? [],
  };
}

/**
 * Board footer primary actions: integration / preview only.
 * Runnable CodeTask selection + Quick Run live in the global toolbar (same routing policy).
 */
export function resolveImplementationBoardPrimaryAction(input: {
  readonly userActionSummary: ImplementationCodeTaskUserActionSummaryV1 & {
    readonly selectedRunnableCodeTaskIds?: readonly string[];
    readonly integrationReadyCodeTaskIds?: readonly string[];
  };
  readonly integratedAppPreviewReady?: boolean;
  readonly integrationPrepareEnabled?: boolean;
  readonly actualPreviewUrl?: string | null;
}): ImplementationBoardPrimaryActionStateV1 {
  const routed = resolveImplementationPrimaryAction({
    selectionSummary: toBoardSelectionSummary(input.userActionSummary),
    previewReady: input.integratedAppPreviewReady,
    actualPreviewUrl: input.actualPreviewUrl,
  });

  let primaryAction: ImplementationBoardPrimaryActionKindV1 = null;
  let primaryLabel: string | null = null;
  let primaryEnabled = false;
  let primaryDisabledTitle: string | null = null;

  if (routed.action === "prepare_integration_preview") {
    primaryAction = "prepare_integration_preview";
    primaryLabel = routed.label;
    primaryEnabled = input.integrationPrepareEnabled === true;
  } else if (
    routed.action === "blocked_no_available_action" &&
    input.userActionSummary.runnableCount === 0 &&
    input.userActionSummary.integrationReadyCount > 0
  ) {
    // Legacy unit/outcome summaries may omit integrationReadyCodeTaskIds; counts still gate integration.
    primaryAction = "prepare_integration_preview";
    primaryLabel = "통합 및 Preview 준비";
    primaryEnabled = input.integrationPrepareEnabled === true;
  } else if (routed.action === "open_preview") {
    primaryAction = "open_preview";
    primaryLabel = routed.label;
    primaryEnabled = routed.enabled;
  } else if (routed.action === "blocked_no_selection" && input.userActionSummary.runnableCount > 0) {
    primaryDisabledTitle = routed.disabledReason;
  }

  const summary = input.userActionSummary;
  const showIntegrationPrepareButton =
    primaryAction === "prepare_integration_preview" ||
    summary.integrationReadyCount > 0 ||
    input.integratedAppPreviewReady === true;

  return {
    primaryAction,
    primaryLabel,
    primaryEnabled,
    primaryDisabledTitle,
    showIntegrationPrepareButton,
    showExecuteSelectedButton: false,
    showReworkSelectedButton: false,
  };
}
