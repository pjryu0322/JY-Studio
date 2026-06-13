import type { ImplementationCodeTaskSelectionSummaryV1 } from "@/lib/prototype/implementationCodeTaskBoardState";
import { resolveImplementationIntegrationControlGate } from "@/lib/prototype/implementationBoardIntegrationGate";
import type { IntegrationGateBlockedDetailV1 } from "@/lib/prototype/implementationIntegrationBoardGateSummary";

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

/**
 * Toolbar Quick Run, board footer, and runtime dispatch share this policy.
 * Input must come from BoardState + checkedCodeTaskIds summary only.
 */
export function resolveImplementationPrimaryAction(input: {
  readonly selectionSummary: ImplementationCodeTaskSelectionSummaryV1;
  readonly previewReady?: boolean;
  readonly actualPreviewUrl?: string | null;
  readonly blockedDetails?: readonly IntegrationGateBlockedDetailV1[];
  readonly projectId?: string | null;
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

  const integrationGate = resolveImplementationIntegrationControlGate({
    summary,
    previewReady,
    actualPreviewUrl: previewUrl || null,
    blockedDetails: input.blockedDetails,
    projectId: input.projectId,
  });

  if (integrationGate.action === "open_preview") {
    const resolution: ImplementationPrimaryActionResolutionV1 = {
      action: "open_preview",
      label: integrationGate.label,
      enabled: true,
      codeTaskIds: [],
      disabledReason: null,
    };
    logImplementationPrimaryActionResolved(summary, resolution);
    return resolution;
  }

  if (integrationGate.action === "prepare_integration_preview" && integrationGate.enabled) {
    const resolution: ImplementationPrimaryActionResolutionV1 = {
      action: "prepare_integration_preview",
      label: integrationGate.label,
      enabled: true,
      codeTaskIds: integrationGate.targetCodeTaskIds,
      disabledReason: null,
    };
    logImplementationPrimaryActionResolved(summary, resolution);
    return resolution;
  }

  const resolution: ImplementationPrimaryActionResolutionV1 = {
    action: "prepare_integration_preview",
    label: integrationGate.label,
    enabled: false,
    codeTaskIds: integrationGate.targetCodeTaskIds,
    disabledReason: integrationGate.disabledReason,
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
      disabledReason: resolution.disabledReason,
      runnableCount: summary.runnableCount,
      selectedRunnableCount: summary.selectedRunnableCount,
      selectedRunnableCodeTaskIds: summary.selectedRunnableCodeTaskIds,
      integrationReadyCount: summary.integrationReadyCount,
      boardExecuteButton: false,
    }),
  );
}
