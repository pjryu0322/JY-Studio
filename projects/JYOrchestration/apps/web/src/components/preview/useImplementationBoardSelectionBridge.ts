"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ImplementationCodeTaskSelectionSummaryV1 } from "@/lib/prototype/implementationCodeTaskBoardState";
import {
  coalesceImplementationBoardLiveSelectedCodeTaskIdsOverride,
  resolveImplementationBoardQuickRunSelection,
  type ImplementationBoardSelectionBridgeSnapshotV1,
} from "@/lib/prototype/implementationBoardCodeTaskSelection";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export type { ImplementationBoardSelectionBridgeSnapshotV1 };

/**
 * Bridges ImplementationExecutionBoardPanel checkbox state to PrototypePreviewPanel
 * toolbar quick-run without syncing from stale persisted board state.
 */
export function useImplementationBoardSelectionBridge(projectId: string) {
  const boardPersistSelectionRef = useRef<readonly string[] | null>(null);
  const liveCheckedCodeTaskIdsRef = useRef<readonly string[] | null>(null);
  const livePanelSummaryRef = useRef<ImplementationCodeTaskSelectionSummaryV1 | null>(null);

  useEffect(() => {
    boardPersistSelectionRef.current = null;
    liveCheckedCodeTaskIdsRef.current = null;
    livePanelSummaryRef.current = null;
  }, [projectId]);

  const onCodeTaskSelectionSummaryChange = useCallback(
    (summary: ImplementationCodeTaskSelectionSummaryV1) => {
      livePanelSummaryRef.current = summary;
    },
    [],
  );

  const recordPersistedBoardSelection = useCallback((selectedCodeTaskIds: readonly string[]) => {
    boardPersistSelectionRef.current = selectedCodeTaskIds;
  }, []);

  const getBridgeSnapshot = useCallback((): ImplementationBoardSelectionBridgeSnapshotV1 => {
    return {
      liveCheckedCodeTaskIds: liveCheckedCodeTaskIdsRef.current,
      boardPersistSelection: boardPersistSelectionRef.current,
      livePanelSummary: livePanelSummaryRef.current,
    };
  }, []);

  const resolveQuickRunSelection = useCallback(
    (input: {
      readonly requirementsState: RequirementsStateJson;
      readonly selectedCodeTaskIdsOverride?: readonly string[] | null;
    }) => {
      const pid = projectId.trim();
      if (!pid) return null;
      const bridge = getBridgeSnapshot();
      const selectionOverride =
        input.selectedCodeTaskIdsOverride ??
        coalesceImplementationBoardLiveSelectedCodeTaskIdsOverride({
          liveCheckedCodeTaskIds: bridge.liveCheckedCodeTaskIds,
          boardPersistHandlerRef: bridge.boardPersistSelection,
        });
      return resolveImplementationBoardQuickRunSelection({
        projectId: pid,
        requirementsState: input.requirementsState,
        livePanelSummary: bridge.livePanelSummary,
        selectedCodeTaskIdsOverride: selectionOverride,
      });
    },
    [projectId, getBridgeSnapshot],
  );

  return {
    liveCheckedCodeTaskIdsRef,
    onCodeTaskSelectionSummaryChange,
    recordPersistedBoardSelection,
    getBridgeSnapshot,
    resolveQuickRunSelection,
  } as const;
}
