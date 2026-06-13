import type { ImplementationCodeTaskSelectionSummaryV1 } from "@/lib/prototype/implementationCodeTaskBoardState";
import { resolveImplementationPrimaryAction } from "@/lib/prototype/implementationActionRoutingPolicy";
import type { IntegrationGateBlockedDetailV1 } from "@/lib/prototype/implementationIntegrationBoardGateSummary";

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
 * Runnable CodeTask selection + Quick Run live in the global toolbar (same routing policy).
 */
export function resolveImplementationBoardPrimaryAction(input: {
  readonly selectionSummary: ImplementationCodeTaskSelectionSummaryV1;
  readonly integratedAppPreviewReady?: boolean;
  /** @deprecated Routing resolution owns enabled state; kept for debug overrides only. */
  readonly integrationPrepareEnabled?: boolean;
  readonly actualPreviewUrl?: string | null;
  readonly blockedDetails?: readonly IntegrationGateBlockedDetailV1[];
  readonly projectId?: string | null;
}): ImplementationBoardPrimaryActionStateV1 {
  const summary = input.selectionSummary;
  const routed = resolveImplementationPrimaryAction({
    selectionSummary: summary,
    previewReady: input.integratedAppPreviewReady,
    actualPreviewUrl: input.actualPreviewUrl,
    blockedDetails: input.blockedDetails,
    projectId: input.projectId,
  });

  let primaryAction: ImplementationBoardPrimaryActionKindV1 = null;
  let primaryLabel: string | null = null;
  let primaryEnabled = false;
  let primaryDisabledTitle: string | null = routed.disabledReason;

  if (routed.action === "prepare_integration_preview") {
    primaryAction = "prepare_integration_preview";
    primaryLabel = routed.label;
    primaryEnabled =
      input.integrationPrepareEnabled === false ? false : routed.enabled;
    primaryDisabledTitle = routed.enabled ? null : routed.disabledReason;
  } else if (routed.action === "open_preview") {
    primaryAction = "open_preview";
    primaryLabel = routed.label;
    primaryEnabled = routed.enabled;
    primaryDisabledTitle = routed.enabled ? null : routed.disabledReason;
  }

  const showIntegrationPrepareButton =
    routed.action === "prepare_integration_preview" ||
    routed.action === "open_preview" ||
    input.integratedAppPreviewReady === true ||
    summary.runnableCount > 0 ||
    summary.integrationReadyCount > 0;

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
