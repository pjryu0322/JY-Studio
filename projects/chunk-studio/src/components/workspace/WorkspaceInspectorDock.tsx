"use client";

import type { RefObject } from "react";
import ChunkInspector from "./ChunkInspector";
import type { WorkspaceStateController } from "./useWorkspaceState";

interface WorkspaceInspectorDockProps {
  state: WorkspaceStateController;
  viewportRef: RefObject<HTMLDivElement | null>;
  onReload: () => Promise<void>;
}

export default function WorkspaceInspectorDock({
  state,
  viewportRef,
  onReload,
}: WorkspaceInspectorDockProps) {
  return (
    <div
      style={{
        position: "absolute",
        left: 12,
        bottom: 12,
        width: 360,
        maxHeight: "calc(100% - 24px)",
        overflowY: "auto",
        zIndex: 40,
        background: "rgba(255,255,255,0.95)",
        border: "1px solid #dbe3f1",
        borderRadius: 12,
        padding: 10,
        boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
        display: state.inspectorOpen ? "block" : "none",
      }}
    >
      <ChunkInspector
        visibleChunks={state.visibleChunks}
        selectedChunk={state.selectedChunk}
        editedLabels={state.editedLabels}
        reviewNotes={state.reviewNotes}
        suggestion={state.selectedChunkSuggestion}
        onSelectChunk={state.selectChunk}
        onFocusChunkInPdf={(chunk) => state.focusChunkInPdf(chunk, viewportRef.current)}
        onExcludeSelected={state.excludeSelectedChunk}
        onMergeSelected={state.mergeSelectedChunk}
        onSplitSelected={state.splitSelectedChunk}
        onReload={onReload}
        onEditLabel={state.setChunkLabel}
        onEditReviewNote={state.setChunkReviewNote}
      />
    </div>
  );
}
