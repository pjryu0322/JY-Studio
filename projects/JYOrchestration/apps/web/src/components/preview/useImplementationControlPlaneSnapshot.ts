"use client";

import { useMemo } from "react";
import {
  buildImplementationControlPlaneSnapshot,
  type ImplementationControlPlaneSnapshotV1,
} from "@/lib/prototype/implementationControlPlaneSnapshot";
import type { ImplementationCodeTaskSelectionSummaryV1 } from "@/lib/prototype/implementationCodeTaskBoardState";
import type { ImplementationCodeTaskBoardStateV1 } from "@/lib/prototype/implementationCodeTaskBoardState";
import type { IntegrationGateBlockedDetailV1 } from "@/lib/prototype/implementationIntegrationBoardGateSummary";

export function useImplementationControlPlaneSnapshot(input: {
  readonly projectId: string;
  readonly selectionSummary: ImplementationCodeTaskSelectionSummaryV1 | null | undefined;
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
}): ImplementationControlPlaneSnapshotV1 | null {
  const pid = input.projectId.trim();
  const summary = input.selectionSummary;

  return useMemo(() => {
    if (!pid || !summary) return null;
    return buildImplementationControlPlaneSnapshot({
      projectId: pid,
      selectionSummary: summary,
      boardNodes: input.boardNodes,
      previewReady: input.previewReady,
      actualPreviewUrl: input.actualPreviewUrl,
      integratedAppPreviewReady: input.integratedAppPreviewReady,
      blockedDetails: input.blockedDetails,
      runtime: input.runtime,
    });
  }, [
    pid,
    summary,
    input.boardNodes,
    input.previewReady,
    input.actualPreviewUrl,
    input.integratedAppPreviewReady,
    input.blockedDetails,
    input.runtime,
  ]);
}
