import type { ImplementationPrimaryActionV1 } from "@/lib/prototype/implementationActionRoutingPolicy";
import { resolveImplementationPrimaryAction } from "@/lib/prototype/implementationActionRoutingPolicy";
import {
  type ImplementationBoardPrimaryActionStateV1,
} from "@/lib/prototype/implementationActionButtonPolicy";
import type { evaluateIntegrationPipelineButtonFromSnapshot } from "@/lib/prototype/implementationIntegrationButtonPolicy";
import {
  listRunnableCodeTaskIdsFromBoardNodes,
  summarizeCodeTaskBoardRowsFromTreeNodes,
  type ImplementationCodeTaskBoardStateV1,
  type ImplementationCodeTaskSelectionSummaryV1,
} from "@/lib/prototype/implementationCodeTaskBoardState";
import {
  isSameBoardGateSummary,
  resolveImplementationIntegrationControlGate,
} from "@/lib/prototype/implementationBoardIntegrationGate";
import type { IntegrationGateBlockedDetailV1 } from "@/lib/prototype/implementationIntegrationBoardGateSummary";

export type ImplementationControlPlaneBoardNodeV1 = Readonly<{
  readonly codeTaskId: string;
  readonly boardState: ImplementationCodeTaskBoardStateV1;
}>;

export type ImplementationControlPlaneSnapshotV1 = Readonly<{
  readonly projectId: string | null;

  readonly board: Readonly<{
    readonly totalExecutableCodeTaskCount: number;
    readonly runnableCodeTaskIds: readonly string[];
    readonly selectedRunnableCodeTaskIds: readonly string[];
    readonly completedCodeTaskIds: readonly string[];
    readonly integrationReadyCodeTaskIds: readonly string[];
    readonly blockedCodeTaskIds: readonly string[];
    readonly selectionSummary: ImplementationCodeTaskSelectionSummaryV1;
  }>;

  readonly action: Readonly<{
    readonly primaryAction: ImplementationPrimaryActionV1;
    readonly label: string;
    readonly enabled: boolean;
    readonly disabledReason: string | null;
    readonly codeTaskIds: readonly string[];
  }>;

  readonly integration: Readonly<{
    readonly ready: boolean;
    readonly enabled: boolean;
    readonly userMessage: string | null;
    readonly disabledReason: string | null;
    readonly targetCodeTaskIds: readonly string[];
  }>;

  readonly preview: Readonly<{
    readonly ready: boolean;
    readonly actualPreviewUrl: string | null;
  }>;

  readonly boardFooter: ImplementationBoardPrimaryActionStateV1;

  readonly runtime: Readonly<{
    readonly hasDbRuntimeJob: boolean;
    readonly currentCodeTaskId: string | null;
    readonly currentRuntimeState: string | null;
    readonly shouldPoll: boolean;
  }>;

  readonly meta: Readonly<{
    readonly source: "implementation_control_plane_snapshot_v1";
    readonly generatedAt: string;
  }>;
}>;

export type BuildImplementationControlPlaneSnapshotInput = Readonly<{
  readonly projectId?: string | null;
  readonly nodes?: readonly ImplementationControlPlaneBoardNodeV1[];
  readonly checkedCodeTaskIds?: readonly string[] | null;
  readonly selectionSummary?: ImplementationCodeTaskSelectionSummaryV1 | null;
  /** @deprecated prefer `nodes` */
  readonly boardNodes?: readonly ImplementationControlPlaneBoardNodeV1[];
  readonly previewReady?: boolean;
  readonly actualPreviewUrl?: string | null;
  readonly integratedAppPreviewReady?: boolean;
  readonly blockedDetails?: readonly IntegrationGateBlockedDetailV1[];
  readonly runnableCodeTaskIds?: readonly string[];
  readonly runtime?: Readonly<{
    readonly hasDbRuntimeJob?: boolean;
    readonly currentCodeTaskId?: string | null;
    readonly currentRuntimeState?: string | null;
    readonly shouldPoll?: boolean;
  }>;
}>;

export function buildImplementationControlPlaneSnapshot(
  input: BuildImplementationControlPlaneSnapshotInput,
): ImplementationControlPlaneSnapshotV1 | null {
  const nodes = input.nodes ?? input.boardNodes ?? [];
  const pid = String(input.projectId ?? "").trim() || null;

  let summary = input.selectionSummary ?? null;
  if (!summary && nodes.length > 0) {
    summary = summarizeCodeTaskBoardRowsFromTreeNodes({
      nodes,
      checkedCodeTaskIds: input.checkedCodeTaskIds ?? [],
    });
  }
  if (!summary) return null;

  const previewReady = input.previewReady === true || input.integratedAppPreviewReady === true;
  const actualPreviewUrl = String(input.actualPreviewUrl ?? "").trim() || null;

  const runnableCodeTaskIds =
    input.runnableCodeTaskIds?.length
      ? [...input.runnableCodeTaskIds]
      : nodes.length > 0
        ? listRunnableCodeTaskIdsFromBoardNodes(nodes)
        : [];

  const integrationGate = resolveImplementationIntegrationControlGate({
    summary,
    previewReady,
    actualPreviewUrl,
    blockedDetails: input.blockedDetails,
    runnableCodeTaskIds,
    projectId: pid,
  });

  const routed = resolveImplementationPrimaryAction({
    selectionSummary: summary,
    previewReady,
    actualPreviewUrl,
    blockedDetails: input.blockedDetails,
    projectId: pid,
  });

  const completedCodeTaskIds =
    nodes.length > 0
      ? nodes
          .filter((n) => n.boardState.isCompleted || n.boardState.isIntegrationReady)
          .map((n) => n.codeTaskId.trim())
          .filter(Boolean)
      : summary.integrationReadyCodeTaskIds;

  const blockedCodeTaskIds = integrationGate.enabled
    ? []
    : runnableCodeTaskIds.length > 0
      ? runnableCodeTaskIds
      : nodes
          .filter((n) => n.boardState.isRunnableForUser)
          .map((n) => n.codeTaskId.trim())
          .filter(Boolean);

  const core: Omit<ImplementationControlPlaneSnapshotV1, "boardFooter" | "meta"> = {
    projectId: pid,
    board: {
      totalExecutableCodeTaskCount: summary.totalCount,
      runnableCodeTaskIds,
      selectedRunnableCodeTaskIds: summary.selectedRunnableCodeTaskIds,
      completedCodeTaskIds,
      integrationReadyCodeTaskIds: summary.integrationReadyCodeTaskIds,
      blockedCodeTaskIds,
      selectionSummary: summary,
    },
    action: {
      primaryAction: routed.action,
      label: routed.label,
      enabled: routed.enabled,
      disabledReason: routed.disabledReason,
      codeTaskIds: routed.codeTaskIds,
    },
    integration: {
      ready: integrationGate.action === "prepare_integration_preview" && integrationGate.enabled,
      enabled: integrationGate.enabled,
      userMessage: integrationGate.userMessage,
      disabledReason: integrationGate.disabledReason,
      targetCodeTaskIds: integrationGate.targetCodeTaskIds,
    },
    preview: {
      ready: previewReady,
      actualPreviewUrl,
    },
    runtime: {
      hasDbRuntimeJob: input.runtime?.hasDbRuntimeJob === true,
      currentCodeTaskId: input.runtime?.currentCodeTaskId?.trim() || null,
      currentRuntimeState: input.runtime?.currentRuntimeState?.trim() || null,
      shouldPoll: input.runtime?.shouldPoll === true,
    },
  };

  return {
    ...core,
    boardFooter: resolveImplementationBoardPrimaryActionFromSnapshot(core),
    meta: {
      source: "implementation_control_plane_snapshot_v1",
      generatedAt: new Date().toISOString(),
    },
  };
}

export function resolveImplementationBoardPrimaryActionFromSnapshot(
  snapshot: Pick<ImplementationControlPlaneSnapshotV1, "action" | "preview" | "board">,
): ImplementationBoardPrimaryActionStateV1 {
  const routed = snapshot.action;

  let primaryAction: ImplementationBoardPrimaryActionStateV1["primaryAction"] = null;
  let primaryLabel: string | null = null;

  if (routed.primaryAction === "prepare_integration_preview") {
    primaryAction = "prepare_integration_preview";
    primaryLabel = routed.label;
  } else if (routed.primaryAction === "open_preview") {
    primaryAction = "open_preview";
    primaryLabel = routed.label;
  }

  const showIntegrationPrepareButton =
    snapshot.board.totalExecutableCodeTaskCount > 0 || snapshot.preview.ready === true;

  return {
    primaryAction,
    primaryLabel,
    primaryEnabled: routed.enabled,
    primaryDisabledTitle: routed.enabled ? null : routed.disabledReason,
    showIntegrationPrepareButton,
    showExecuteSelectedButton: false,
    showReworkSelectedButton: false,
  };
}

/** Applies control-plane integration gate on top of runtime integration button policy. */
export function applyControlPlaneIntegrationPipelineButtonGate(input: {
  readonly runtimeButton: ReturnType<typeof evaluateIntegrationPipelineButtonFromSnapshot>;
  readonly controlPlane: ImplementationControlPlaneSnapshotV1 | null;
}): ReturnType<typeof evaluateIntegrationPipelineButtonFromSnapshot> {
  const { runtimeButton, controlPlane } = input;
  if (!controlPlane || runtimeButton.continueBuildPreview) {
    return runtimeButton;
  }
  if (!runtimeButton.enabled || controlPlane.integration.enabled) {
    return runtimeButton;
  }
  const disabledTitle =
    controlPlane.integration.disabledReason ??
    controlPlane.action.disabledReason ??
    runtimeButton.disabledTitle;
  return {
    ...runtimeButton,
    enabled: false,
    disabledTitle,
    disabledReasonLines: disabledTitle ? [disabledTitle] : runtimeButton.disabledReasonLines,
  };
}

export function isSameControlPlaneBoardSummary(
  a: ImplementationCodeTaskSelectionSummaryV1 | null | undefined,
  b: ImplementationCodeTaskSelectionSummaryV1 | null | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return isSameBoardGateSummary(a, b);
}

export function pickEffectiveImplementationControlPlaneSnapshot(input: {
  readonly local: ImplementationControlPlaneSnapshotV1 | null | undefined;
  readonly parent: ImplementationControlPlaneSnapshotV1 | null | undefined;
}): ImplementationControlPlaneSnapshotV1 | null {
  return input.local ?? input.parent ?? null;
}

/** Client advisory summary for integration pipeline start (server recomputes gate). */
export function pickIntegrationPipelineClientBoardSummary(input: {
  readonly bridgeSummary?: ImplementationCodeTaskSelectionSummaryV1 | null;
  readonly parentSnapshot?: ImplementationControlPlaneSnapshotV1 | null;
}): ImplementationCodeTaskSelectionSummaryV1 | null {
  return input.bridgeSummary ?? input.parentSnapshot?.board.selectionSummary ?? null;
}
