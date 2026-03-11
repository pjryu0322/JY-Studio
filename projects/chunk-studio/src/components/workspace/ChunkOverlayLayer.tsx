"use client";

import type { ChunkDTO } from "@/types/job";

interface ChunkOverlayLayerProps {
  chunks: ChunkDTO[];
  currentPage: number;
  selectedChunkId: string | null;
  onSelectChunk: (chunk: ChunkDTO) => void;
}

export default function ChunkOverlayLayer({
  chunks,
  currentPage,
  selectedChunkId,
  onSelectChunk,
}: ChunkOverlayLayerProps) {
  const visible = chunks
    .filter((chunk) => {
      const pageRange = (chunk.meta as unknown as { pageRange?: [number, number] }).pageRange;
      if (!Array.isArray(pageRange) || pageRange.length !== 2) return currentPage <= 1;
      return currentPage >= pageRange[0] && currentPage <= pageRange[1];
    })
    .slice(0, 20);

  if (visible.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        zIndex: 20,
        display: "grid",
        gap: 6,
        maxWidth: 260,
      }}
    >
      {visible.map((chunk, index) => {
        const isSelected = selectedChunkId === chunk.meta.chunkId;
        return (
          <button
            key={chunk.meta.chunkId}
            type="button"
            onClick={() => onSelectChunk(chunk)}
            style={{
              textAlign: "left",
              border: isSelected ? "1px solid #1d4ed8" : "1px solid rgba(59,130,246,0.4)",
              borderRadius: 8,
              padding: "6px 8px",
              background: isSelected ? "rgba(219,234,254,0.95)" : "rgba(239,246,255,0.82)",
              color: "#1e3a8a",
              fontSize: 11,
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(15,23,42,0.08)",
            }}
            title={chunk.meta.sectionPath.join(" > ") || "Unsectioned"}
          >
            #{index + 1} {chunk.meta.chunkId}
            <div style={{ marginTop: 2, color: "#334155" }}>
              {chunk.meta.sectionTitle || chunk.meta.sectionPath.at(-1) || "Unsectioned"}
            </div>
          </button>
        );
      })}
    </div>
  );
}
