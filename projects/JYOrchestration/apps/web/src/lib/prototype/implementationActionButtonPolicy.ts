import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import {
  evaluateExecutionSelectionGate,
  filterCodeTaskIdsForSelectionMode,
} from "@/lib/prototype/implementationCodeTaskSelectionPolicy";

export type ImplementationBoardPrimaryActionKindV1 =
  | "execute_selected"
  | "rework_selected"
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
  readonly codeTasks: readonly ImplementationCodeTaskV1[];
  readonly units?: readonly ImplementationExecutionUnitV1[] | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly progressByCodeTaskId?: ReadonlyMap<string, { readonly statusLabel: string; readonly progressLabel: string }>;
  readonly integratedAppPreviewReady?: boolean;
  readonly integrationPrepareEnabled?: boolean;
}): ImplementationBoardPrimaryActionStateV1 {
  const selected = [...new Set(input.selectedCodeTaskIds.map((id) => id.trim()).filter(Boolean))];

  const executionIds = filterCodeTaskIdsForSelectionMode({
    codeTaskIds: selected,
    mode: "execution",
    codeTasks: input.codeTasks,
    units: input.units,
    runs: input.runs,
    progressByCodeTaskId: input.progressByCodeTaskId,
  });
  const reworkIds = filterCodeTaskIdsForSelectionMode({
    codeTaskIds: selected,
    mode: "rework",
    codeTasks: input.codeTasks,
    units: input.units,
    runs: input.runs,
    progressByCodeTaskId: input.progressByCodeTaskId,
  });
  const integrationIds = filterCodeTaskIdsForSelectionMode({
    codeTaskIds: selected,
    mode: "integration",
    codeTasks: input.codeTasks,
    units: input.units,
    runs: input.runs,
    progressByCodeTaskId: input.progressByCodeTaskId,
  });

  const executionGate = evaluateExecutionSelectionGate({
    selectedCodeTaskIds: selected,
    mode: "execution",
    codeTasks: input.codeTasks,
    units: input.units,
    runs: input.runs,
  });

  const hasExecutionSelection = executionIds.length > 0;
  const hasReworkOnly =
    reworkIds.length > 0 &&
    reworkIds.length === selected.length &&
    executionIds.length === 0;
  const hasIntegrationOnly =
    integrationIds.length > 0 &&
    integrationIds.length === selected.length &&
    executionIds.length === 0;

  let primaryAction: ImplementationBoardPrimaryActionKindV1 = null;
  let primaryLabel: string | null = null;
  let primaryEnabled = false;
  let primaryDisabledTitle: string | null = null;

  if (hasExecutionSelection) {
    primaryAction = "execute_selected";
    primaryLabel = "선택 작업 실행";
    primaryEnabled = executionGate.ok;
    primaryDisabledTitle = executionGate.ok ? null : executionGate.message;
  } else if (hasReworkOnly) {
    primaryAction = "rework_selected";
    primaryLabel = "선택 작업 재작업";
    primaryEnabled = reworkIds.length > 0;
  } else if (hasIntegrationOnly) {
    primaryAction = "prepare_integration_preview";
    primaryLabel = "통합 및 Preview 준비";
    primaryEnabled = input.integrationPrepareEnabled === true;
  } else if (input.integratedAppPreviewReady) {
    primaryAction = "open_preview";
    primaryLabel = "Preview 보기";
    primaryEnabled = true;
  }

  const showExecuteSelectedButton = primaryAction === "execute_selected";
  const showReworkSelectedButton = primaryAction === "rework_selected";
  const showIntegrationPrepareButton =
    primaryAction === "prepare_integration_preview" ||
    (!hasExecutionSelection && !hasReworkOnly && integrationIds.length > 0);

  const state: ImplementationBoardPrimaryActionStateV1 = {
    primaryAction,
    primaryLabel,
    primaryEnabled,
    primaryDisabledTitle,
    showIntegrationPrepareButton: showIntegrationPrepareButton && !hasExecutionSelection,
    showExecuteSelectedButton,
    showReworkSelectedButton,
  };

  console.info(
    JSON.stringify({
      action: "implementation_primary_action_resolved",
      primaryAction: state.primaryAction,
      primaryEnabled: state.primaryEnabled,
      selectedCount: selected.length,
      executionSelectableCount: executionIds.length,
      integrationSelectableCount: integrationIds.length,
    }),
  );

  return state;
}
