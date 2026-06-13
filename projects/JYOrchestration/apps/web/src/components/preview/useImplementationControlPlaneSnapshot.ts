"use client";

import { useMemo } from "react";
import {
  buildImplementationControlPlaneSnapshot,
  type ImplementationControlPlaneBoardNodeV1,
  type ImplementationControlPlaneSnapshotV1,
} from "@/lib/prototype/implementationControlPlaneSnapshot";
import type { ImplementationCodeTaskSelectionSummaryV1 } from "@/lib/prototype/implementationCodeTaskBoardState";
import type { IntegrationGateBlockedDetailV1 } from "@/lib/prototype/implementationIntegrationBoardGateSummary";

export function useImplementationControlPlaneSnapshot(input: {
  readonly projectId: string;
  readonly selectionSummary?: ImplementationCodeTaskSelectionSummaryV1 | null;
  readonly nodes?: readonly ImplementationControlPlaneBoardNodeV1[];
  readonly checkedCodeTaskIds?: readonly string[] | null;
  /** @deprecated prefer `nodes` */
  readonly boardNodes?: readonly ImplementationControlPlaneBoardNodeV1[];
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
}): ImplementationControlPlaneSnapshotV1 | null {
  const pid = input.projectId.trim();
  const summary = input.selectionSummary;

  return useMemo(() => {
    if (!pid) return null;
    return buildImplementationControlPlaneSnapshot({
      projectId: pid,
      selectionSummary: summary,
      nodes: input.nodes ?? input.boardNodes,
      checkedCodeTaskIds: input.checkedCodeTaskIds,
      previewReady: input.previewReady,
      actualPreviewUrl: input.actualPreviewUrl,
      integratedAppPreviewReady: input.integratedAppPreviewReady,
      blockedDetails: input.blockedDetails,
      runtime: input.runtime,
    });
  }, [
    pid,
    summary,
    input.nodes,
    input.boardNodes,
    input.checkedCodeTaskIds,
    input.previewReady,
    input.actualPreviewUrl,
    input.integratedAppPreviewReady,
    input.blockedDetails,
    input.runtime,
  ]);
}
