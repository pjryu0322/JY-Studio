import type { ImplementationCodeTaskUserActionSummaryV1 } from "@/lib/prototype/implementationCodeTaskSelectionSummary";
import { evaluateSelectedRunnableCodeTasksGateFromBoard } from "@/lib/prototype/implementationCodeTaskBoardState";

export type ImplementationBoardPrimaryActionKindV1 =
  | "execute_selected_runnable_codetasks"
  | "prepare_integration_preview"
  | "open_preview"
  | null;

export type ImplementationBoardPrimaryActionStateV1 = Readonly<{
  readonly primaryAction: ImplementationBoardPrimaryActionKindV1;
  readonly primaryLabel: string | null;
  readonly primaryEnabled: boolean;
  readonly primaryDisabledTitle: string | null;
  readonly showIntegrationPrepareButton: boolean;
  readonly showExecuteSelectedButton: boolean;
  readonly showReworkSelectedButton: boolean;
}>;

export function resolveImplementationBoardPrimaryAction(input: {
  readonly selectedCodeTaskIds: readonly string[];
  readonly userActionSummary: ImplementationCodeTaskUserActionSummaryV1;
  readonly runnableCodeTaskIds: readonly string[];
  readonly integratedAppPreviewReady?: boolean;
  readonly integrationPrepareEnabled?: boolean;
}): ImplementationBoardPrimaryActionStateV1 {
  const summary = input.userActionSummary;

  const executionGate = evaluateSelectedRunnableCodeTasksGateFromBoard({
    selectedCodeTaskIds: input.selectedCodeTaskIds,
    runnableCodeTaskIds: input.runnableCodeTaskIds,
  });

  let primaryAction: ImplementationBoardPrimaryActionKindV1 = null;
  let primaryLabel: string | null = null;
  let primaryEnabled = false;
  let primaryDisabledTitle: string | null = null;

  if (summary.selectedRunnableCount > 0) {
    primaryAction = "execute_selected_runnable_codetasks";
    primaryLabel = "선택 작업 실행";
    primaryEnabled = executionGate.ok;
    primaryDisabledTitle = executionGate.ok ? null : executionGate.message;
  } else if (summary.runnableCount > 0) {
    primaryAction = "execute_selected_runnable_codetasks";
    primaryLabel = "선택 작업 실행";
    primaryEnabled = false;
    primaryDisabledTitle = "실행할 CodeTask를 선택해 주세요.";
  } else if (
    summary.runnableCount === 0 &&
    summary.integrationReadyCount > 0
  ) {
    primaryAction = "prepare_integration_preview";
    primaryLabel = "통합 및 Preview 준비";
    primaryEnabled = input.integrationPrepareEnabled === true;
  } else if (input.integratedAppPreviewReady) {
    primaryAction = "open_preview";
    primaryLabel = "Preview 보기";
    primaryEnabled = true;
  }

  const showExecuteSelectedButton =
    summary.runnableCount > 0 || summary.selectedRunnableCount > 0;
  const showIntegrationPrepareButton =
    summary.selectedRunnableCount === 0 &&
    summary.runnableCount === 0 &&
    (primaryAction === "prepare_integration_preview" || summary.integrationReadyCount > 0);

  const state: ImplementationBoardPrimaryActionStateV1 = {
    primaryAction,
    primaryLabel,
    primaryEnabled,
    primaryDisabledTitle,
    showIntegrationPrepareButton,
    showExecuteSelectedButton,
    showReworkSelectedButton: false,
  };

  console.info(
    JSON.stringify({
      action: "implementation_primary_action_resolved",
      primaryAction: state.primaryAction,
      primaryEnabled: state.primaryEnabled,
      selectedRunnableCount: summary.selectedRunnableCount,
      runnableCount: summary.runnableCount,
      integrationReadyCount: summary.integrationReadyCount,
    }),
  );

  return state;
}
