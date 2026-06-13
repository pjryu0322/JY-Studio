import { resolveImplementationPrimaryAction } from "@/lib/prototype/implementationActionRoutingPolicy";
import { resolveImplementationBoardPrimaryAction } from "@/lib/prototype/implementationActionButtonPolicy";
import {
  listRunnableCodeTaskIdsFromBoardNodes,
  type ImplementationCodeTaskBoardStateV1,
  type ImplementationCodeTaskSelectionSummaryV1,
} from "@/lib/prototype/implementationCodeTaskBoardState";
import { resolveImplementationIntegrationControlGate } from "@/lib/prototype/implementationBoardIntegrationGate";
import type { IntegrationGateBlockedDetailV1 } from "@/lib/prototype/implementationIntegrationBoardGateSummary";

export type ImplementationControlPlaneSnapshotV1 = Readonly<{
  readonly projectId: string;

  readonly board: Readonly<{
    readonly totalExecutableCodeTaskCount: number;
    readonly runnableCodeTaskIds: readonly string[];
    readonly selectedRunnableCodeTaskIds: readonly string[];
    readonly completedCodeTaskIds: readonly string[];
    readonly integrationReadyCodeTaskIds: readonly string[];
    readonly blockedCodeTaskIds: readonly string[];
  }>;

  readonly integration: Readonly<{
    readonly ready: boolean;
    readonly enabled: boolean;
    readonly action: "prepare_integration_preview" | "open_preview" | "blocked";
    readonly userMessage: string | null;
    readonly disabledReason: string | null;
    readonly targetCodeTaskIds: readonly string[];
  }>;

  readonly preview: Readonly<{
    readonly ready: boolean;
    readonly actualPreviewUrl: string | null;
  }>;

  readonly runtime: Readonly<{
    readonly hasDbRuntimeJob: boolean;
    readonly currentCodeTaskId: string | null;
    readonly currentRuntimeState: string | null;
    readonly shouldPoll: boolean;
  }>;

  readonly primaryAction: ReturnType<typeof resolveImplementationPrimaryAction>;
  readonly boardPrimaryAction: ReturnType<typeof resolveImplementationBoardPrimaryAction>;
}>;

export function buildImplementationControlPlaneSnapshot(input: {
  readonly projectId: string;
  readonly selectionSummary: ImplementationCodeTaskSelectionSummaryV1;
  readonly boardNodes?: readonly {
    readonly codeTaskId: string;
    readonly boardState: ImplementationCodeTaskBoardStateV1;
  }[];
  readonly previewReady?: boolean;
  readonly actualPreviewUrl?: string | null;
  readonly integratedAppPreviewReady?: boolean;
  readonly blockedDetails?: readonly IntegrationGateBlockedDetailV1[];
  readonly runtime?: Readonly<{
    readonly hasDbRuntimeJob?: boolean;
    readonly currentCodeTaskId?: string | null;
    readonly currentRuntimeState?: string | null;
    readonly shouldPoll?: boolean;
  }>;
}): ImplementationControlPlaneSnapshotV1 {
  const pid = input.projectId.trim();
  const summary = input.selectionSummary;
  const nodes = input.boardNodes ?? [];
  const previewReady = input.previewReady === true || input.integratedAppPreviewReady === true;
  const actualPreviewUrl = String(input.actualPreviewUrl ?? "").trim() || null;

  const runnableCodeTaskIds =
    nodes.length > 0
      ? listRunnableCodeTaskIdsFromBoardNodes(nodes)
      : summary.runnableCount > 0
        ? []
        : [];

  const integrationGate = resolveImplementationIntegrationControlGate({
    summary,
    previewReady,
    actualPreviewUrl,
    blockedDetails: input.blockedDetails,
    projectId: pid,
  });

  const primaryAction = resolveImplementationPrimaryAction({
    selectionSummary: summary,
    previewReady,
    actualPreviewUrl,
    blockedDetails: input.blockedDetails,
    projectId: pid,
  });

  const boardPrimaryAction = resolveImplementationBoardPrimaryAction({
    selectionSummary: summary,
    integratedAppPreviewReady: previewReady,
    actualPreviewUrl,
    blockedDetails: input.blockedDetails,
    projectId: pid,
  });

  const completedCodeTaskIds = nodes
    .filter((n) => n.boardState.isCompleted || n.boardState.isIntegrationReady)
    .map((n) => n.codeTaskId.trim())
    .filter(Boolean);

  const blockedCodeTaskIds = integrationGate.enabled
    ? []
    : nodes
        .filter((n) => n.boardState.isRunnableForUser)
        .map((n) => n.codeTaskId.trim())
        .filter(Boolean);

  return {
    projectId: pid,
    board: {
      totalExecutableCodeTaskCount: summary.totalCount,
      runnableCodeTaskIds:
        runnableCodeTaskIds.length > 0
          ? runnableCodeTaskIds
          : summary.runnableCount > 0
            ? []
            : [],
      selectedRunnableCodeTaskIds: summary.selectedRunnableCodeTaskIds,
      completedCodeTaskIds,
      integrationReadyCodeTaskIds: summary.integrationReadyCodeTaskIds,
      blockedCodeTaskIds,
    },
    integration: {
      ready: integrationGate.action === "prepare_integration_preview" && integrationGate.enabled,
      enabled: integrationGate.enabled,
      action: integrationGate.action,
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
    primaryAction,
    boardPrimaryAction,
  };
}
