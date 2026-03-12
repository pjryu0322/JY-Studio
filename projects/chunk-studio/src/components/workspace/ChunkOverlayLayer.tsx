"use client";

import { useEffect, useRef, useState } from "react";
import type { ChunkDTO } from "@/types/job";

interface ChunkOverlayLayerProps {
  chunks: ChunkDTO[];
  pageNumber: number;
  pageSize: { width: number; height: number };
  selectedChunkId: string | null;
  boundaryRatios?: number[];
  onBoundaryRatiosChange?: (ratios: number[]) => void;
  onSelectChunk: (chunk: ChunkDTO) => void;
  onHoverChunk?: (chunkId: string | null) => void;
}

export default function ChunkOverlayLayer({
  chunks,
  pageNumber,
  pageSize,
  selectedChunkId,
  boundaryRatios,
  onBoundaryRatiosChange,
  onSelectChunk,
  onHoverChunk,
}: ChunkOverlayLayerProps) {
  const [hoveredChunkId, setHoveredChunkId] = useState<string | null>(null);
  const [draggingBoundaryIndex, setDraggingBoundaryIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const visible = chunks
    .filter((chunk) => {
      const pageRange = (chunk.meta as unknown as { pageRange?: [number, number] }).pageRange;
      if (!Array.isArray(pageRange) || pageRange.length !== 2) return pageNumber <= 1;
      return pageNumber >= pageRange[0] && pageNumber <= pageRange[1];
    })
    .sort((a, b) => a.meta.startBlockIdx - b.meta.startBlockIdx)
    .slice(0, 30);
  const hasVisible = visible.length > 0;
  const minStart = hasVisible ? Math.min(...visible.map((chunk) => chunk.meta.startBlockIdx)) : 0;
  const maxEnd = hasVisible ? Math.max(...visible.map((chunk) => chunk.meta.endBlockIdx)) : 1;
  const span = Math.max(1, maxEnd - minStart + 1);

  const basePositioned = visible.map((chunk, index) => {
    const startRatio = (chunk.meta.startBlockIdx - minStart) / span;
    const endRatio = (chunk.meta.endBlockIdx - minStart + 1) / span;
    return { chunk, index, startRatio, endRatio };
  });
  const baseBoundaries = basePositioned.slice(0, -1).map((item) => item.endRatio);
  const activeBoundaries = (() => {
    if (!boundaryRatios || boundaryRatios.length !== baseBoundaries.length) return baseBoundaries;
    const minGap = 0.02;
    const next = [...boundaryRatios];
    for (let i = 0; i < next.length; i += 1) {
      const lower = i === 0 ? minGap : next[i - 1] + minGap;
      const upper = i === next.length - 1 ? 1 - minGap : (next[i + 1] ?? 1) - minGap;
      next[i] = clamp(next[i], lower, upper);
    }
    return next;
  })();
  const positioned = visible.map((chunk, index) => ({
    chunk,
    index,
    startRatio: index === 0 ? 0 : activeBoundaries[index - 1],
    endRatio: index === visible.length - 1 ? 1 : activeBoundaries[index],
  }));

  useEffect(() => {
    if (!hasVisible) return;
    if (draggingBoundaryIndex == null) return;
    const onMove = (event: MouseEvent) => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect || !onBoundaryRatiosChange) return;
      const ratio = clamp((event.clientY - rect.top) / rect.height, 0.02, 0.98);
      const next = [...activeBoundaries];
      const minGap = 0.02;
      const lower = draggingBoundaryIndex === 0 ? minGap : next[draggingBoundaryIndex - 1] + minGap;
      const upper =
        draggingBoundaryIndex === next.length - 1
          ? 1 - minGap
          : next[draggingBoundaryIndex + 1] - minGap;
      next[draggingBoundaryIndex] = clamp(ratio, lower, upper);
      onBoundaryRatiosChange(next);
    };
    const onUp = () => setDraggingBoundaryIndex(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [activeBoundaries, draggingBoundaryIndex, hasVisible, onBoundaryRatiosChange]);

  if (!hasVisible) return null;

  return (
    <div
      ref={rootRef}
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
            onMouseEnter={() => {
              setHoveredChunkId(chunk.meta.chunkId);
              onHoverChunk?.(chunk.meta.chunkId);
            }}
            onMouseLeave={() => {
              setHoveredChunkId(null);
              onHoverChunk?.(null);
            }}
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
      {activeBoundaries.map((ratio, index) => (
        <div
          key={`boundary-${index}`}
          onMouseDown={() => setDraggingBoundaryIndex(index)}
          style={{
            position: "absolute",
            left: 8,
            right: 8,
            top: Math.floor(ratio * pageSize.height),
            borderTop: "2px dashed rgba(15,23,42,0.55)",
            cursor: "ns-resize",
            pointerEvents: "auto",
          }}
          title="경계선 드래그로 청크 경계를 조정하세요"
        />
      ))}
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
