"use client";

import { useState } from "react";
import type { ChunkDTO } from "@/types/job";

interface ChunkOverlayLayerProps {
  chunks: ChunkDTO[];
  pageNumber: number;
  pageSize: { width: number; height: number };
  selectedChunkId: string | null;
  onSelectChunk: (chunk: ChunkDTO) => void;
}

export default function ChunkOverlayLayer({
  chunks,
  pageNumber,
  pageSize,
  selectedChunkId,
  onSelectChunk,
}: ChunkOverlayLayerProps) {
  const [hoveredChunkId, setHoveredChunkId] = useState<string | null>(null);
  const visible = chunks
    .filter((chunk) => {
      const pageRange = (chunk.meta as unknown as { pageRange?: [number, number] }).pageRange;
      if (!Array.isArray(pageRange) || pageRange.length !== 2) return pageNumber <= 1;
      return pageNumber >= pageRange[0] && pageNumber <= pageRange[1];
    })
    .sort((a, b) => a.meta.startBlockIdx - b.meta.startBlockIdx)
    .slice(0, 30);

  if (visible.length === 0) return null;

  const minStart = Math.min(...visible.map((chunk) => chunk.meta.startBlockIdx));
  const maxEnd = Math.max(...visible.map((chunk) => chunk.meta.endBlockIdx));
  const span = Math.max(1, maxEnd - minStart + 1);

  const positioned = visible.map((chunk, index) => {
    const startRatio = (chunk.meta.startBlockIdx - minStart) / span;
    const endRatio = (chunk.meta.endBlockIdx - minStart + 1) / span;
    return { chunk, index, startRatio, endRatio };
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 10,
        pointerEvents: "none",
      }}
    >
      {positioned.map(({ chunk, index, startRatio, endRatio }) => {
        const top = Math.max(2, Math.floor(startRatio * pageSize.height));
        const bottom = Math.max(top + 18, Math.floor(endRatio * pageSize.height) - 2);
        const isHovered = hoveredChunkId === chunk.meta.chunkId;
        const isSelected = selectedChunkId === chunk.meta.chunkId;
        return (
          <button
            key={chunk.meta.chunkId}
            type="button"
            onClick={() => onSelectChunk(chunk)}
            onMouseEnter={() => setHoveredChunkId(chunk.meta.chunkId)}
            onMouseLeave={() => setHoveredChunkId(null)}
            style={{
              textAlign: "left",
              position: "absolute",
              left: 8,
              right: 8,
              top,
              height: bottom - top,
              pointerEvents: "auto",
              border: isSelected
                ? "2px solid #1d4ed8"
                : isHovered
                  ? "2px solid rgba(37,99,235,0.9)"
                  : "2px solid rgba(37,99,235,0.65)",
              borderRadius: 8,
              padding: "4px 6px",
              background: isSelected
                ? "rgba(0,120,255,0.14)"
                : isHovered
                  ? "rgba(0,120,255,0.12)"
                  : "rgba(0,120,255,0.08)",
              color: "#1e3a8a",
              fontSize: 10,
              cursor: "pointer",
              boxShadow: isSelected ? "0 0 0 1px rgba(37,99,235,0.2) inset" : undefined,
              overflow: "hidden",
            }}
            title={chunk.meta.sectionPath.join(" > ") || "Unsectioned"}
          >
            <div style={{ fontWeight: 700 }}>
              #{index + 1} {chunk.meta.chunkId}
            </div>
            <div style={{ marginTop: 1, color: "#334155", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
              {chunk.meta.sectionTitle || chunk.meta.sectionPath.at(-1) || "Unsectioned"}
            </div>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                borderTop: "2px solid rgba(37,99,235,0.95)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                borderBottom: "1px dashed rgba(37,99,235,0.9)",
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
