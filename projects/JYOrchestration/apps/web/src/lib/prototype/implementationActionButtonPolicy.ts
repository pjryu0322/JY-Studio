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

/**
 * Board footer primary actions: integration / preview only.
 * Runnable CodeTask selection + Quick Run live in the global toolbar.
 */
export function resolveImplementationBoardPrimaryAction(input: {
  readonly userActionSummary: ImplementationCodeTaskUserActionSummaryV1;
  readonly integratedAppPreviewReady?: boolean;
  readonly integrationPrepareEnabled?: boolean;
}): ImplementationBoardPrimaryActionStateV1 {
  const summary = input.userActionSummary;

  let primaryAction: ImplementationBoardPrimaryActionKindV1 = null;
  let primaryLabel: string | null = null;
  let primaryEnabled = false;
  let primaryDisabledTitle: string | null = null;

  if (summary.runnableCount === 0 && summary.integrationReadyCount > 0) {
    primaryAction = "prepare_integration_preview";
    primaryLabel = "통합 및 Preview 준비";
    primaryEnabled = input.integrationPrepareEnabled === true;
  } else if (input.integratedAppPreviewReady && summary.runnableCount === 0) {
    primaryAction = "open_preview";
    primaryLabel = "Preview 보기";
    primaryEnabled = true;
  }

  const showIntegrationPrepareButton =
    primaryAction === "prepare_integration_preview" ||
    summary.integrationReadyCount > 0 ||
    input.integratedAppPreviewReady === true;

  const state: ImplementationBoardPrimaryActionStateV1 = {
    primaryAction,
    primaryLabel,
    primaryEnabled,
    primaryDisabledTitle,
    showIntegrationPrepareButton,
    showExecuteSelectedButton: false,
    showReworkSelectedButton: false,
  };

  console.info(
    JSON.stringify({
      action: "implementation_primary_action_resolved",
      primaryAction: state.primaryAction,
      primaryEnabled: state.primaryEnabled,
      runnableCount: summary.runnableCount,
      integrationReadyCount: summary.integrationReadyCount,
      boardExecuteButton: false,
    }),
  );

  return state;
}
