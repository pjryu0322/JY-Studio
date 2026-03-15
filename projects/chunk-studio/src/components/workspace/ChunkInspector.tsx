"use client";

import type { ChunkDTO } from "@/types/job";
import { mapChunkToPage } from "@/lib/analysis/chunkMappingService";

interface ChunkInspectorProps {
  visibleChunks: ChunkDTO[];
  selectedChunk: ChunkDTO | null;
  editedLabels: Record<string, string>;
  reviewNotes: Record<string, string>;
  suggestion: string;
  onSelectChunk: (chunkId: string) => void;
  onFocusChunkInPdf: (chunk: ChunkDTO) => void;
  onExcludeSelected: () => void;
  onMergeSelected: () => void;
  onSplitSelected: () => void;
  onReload: () => Promise<void>;
  onEditLabel: (chunkId: string, value: string) => void;
  onEditReviewNote: (chunkId: string, value: string) => void;
}

export default function ChunkInspector({
  visibleChunks,
  selectedChunk,
  editedLabels,
  reviewNotes,
  suggestion,
  onSelectChunk,
  onFocusChunkInPdf,
  onExcludeSelected,
  onMergeSelected,
  onSplitSelected,
  onReload,
  onEditLabel,
  onEditReviewNote,
}: ChunkInspectorProps) {
  return (
    <div
      style={{
        borderTop: "1px solid #e2e8f0",
        paddingTop: 10,
        display: "grid",
        gap: 8,
      }}
    >
      <strong style={{ fontSize: 13, color: "#0f172a" }}>
        Semantic Chunk Editor
      </strong>
      <div
        style={{
          display: "grid",
          gap: 6,
          maxHeight: 220,
          overflowY: "auto",
        }}
      >
        {visibleChunks.map((chunk) => {
          const selected =
            selectedChunk?.meta.chunkId === chunk.meta.chunkId;
          const mapped = mapChunkToPage(chunk);
          return (
            <button
              key={chunk.meta.chunkId}
              type="button"
              onClick={() => {
                onSelectChunk(chunk.meta.chunkId);
                onFocusChunkInPdf(chunk);
              }}
              style={{
                textAlign: "left",
                border: selected
                  ? "1px solid #2563eb"
                  : "1px solid #dbe3f1",
                borderRadius: 8,
                background: selected ? "#eff6ff" : "#fff",
                padding: 8,
                display: "grid",
                gap: 4,
              }}
            >
              <strong style={{ fontSize: 12, color: "#0f172a" }}>
                {chunk.meta.chunkId}
              </strong>
              <span style={{ fontSize: 11, color: "#64748b" }}>
                page {mapped.pageStart ?? "-"}~{mapped.pageEnd ?? "-"}
              </span>
              <span style={{ fontSize: 11, color: "#334155" }}>
                {chunk.text.slice(0, 120)}
              </span>
            </button>
          );
        })}
        {visibleChunks.length === 0 && (
          <div style={{ fontSize: 12, color: "#64748b" }}>
            표시할 청크가 없습니다.
          </div>
        )}
      </div>
      {selectedChunk && (
        <div
          style={{
            border: "1px solid #dbe3f1",
            borderRadius: 10,
            background: "#fff",
            padding: 8,
            display: "grid",
            gap: 6,
          }}
        >
          <div style={{ fontSize: 12, color: "#334155" }}>
            selected: {selectedChunk.meta.chunkId}
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            boundary drag: 오버레이 상/하단 주황 핸들을 드래그해
            경계를 조정하세요.
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            ai suggestion: {suggestion}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              type="button"
              style={floatingButton}
              onClick={onExcludeSelected}
            >
              exclude
            </button>
            <button
              type="button"
              style={floatingButton}
              onClick={onMergeSelected}
            >
              merge
            </button>
            <button
              type="button"
              style={floatingButton}
              onClick={onSplitSelected}
            >
              split
            </button>
            <button
              type="button"
              style={floatingButton}
              onClick={() => void onReload()}
            >
              save/reload
            </button>
          </div>
          <input
            value={
              editedLabels[selectedChunk.meta.chunkId] ??
              selectedChunk.meta.sectionTitle ??
              ""
            }
            onChange={(e) =>
              onEditLabel(selectedChunk.meta.chunkId, e.target.value)
            }
            placeholder="label edit"
            style={selector}
          />
          <textarea
            value={reviewNotes[selectedChunk.meta.chunkId] ?? ""}
            onChange={(e) =>
              onEditReviewNote(
                selectedChunk.meta.chunkId,
                e.target.value,
              )
            }
            rows={3}
            placeholder="review note"
            style={{ ...selector, resize: "vertical" }}
          />
        </div>
      )}
    </div>
  );
}

const floatingButton = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff",
  fontSize: 12,
  padding: "6px 10px",
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(15,23,42,0.08)",
} as const;

const selector = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff",
  fontSize: 12,
  padding: "6px 8px",
  color: "#334155",
  width: "100%",
} as const;
