"use client";

import type { MouseEvent as ReactMouseEvent } from "react";
import type { ChunkDTO } from "@/types/job";
import { mapChunkToPage } from "@/lib/analysis/chunkMappingService";

interface DragBoundaryInput {
  chunkId: string;
  pageNumber: number;
  handle: "top" | "bottom";
  y: number;
  h: number;
}

interface ChunkOverlayCanvasProps {
  pageNumber: number;
  visibleChunks: ChunkDTO[];
  selectedChunkId: string | null;
  hoveredAnalyzerPage: number | null;
  overlayAnchorByKey: Record<
    string,
    { x: number; y: number; w: number; h: number }
  >;
  onSelectChunk: (chunkId: string) => void;
  onStartBoundaryDrag: (
    event: ReactMouseEvent<HTMLDivElement>,
    input: DragBoundaryInput,
  ) => void;
}

export default function ChunkOverlayCanvas({
  pageNumber,
  visibleChunks,
  selectedChunkId,
  hoveredAnalyzerPage,
  overlayAnchorByKey,
  onSelectChunk,
  onStartBoundaryDrag,
}: ChunkOverlayCanvasProps) {
  const chunkOverlays = visibleChunks
    .map((chunk) => ({
      chunk,
      mapped: mapChunkToPage(chunk),
    }))
    .filter(({ mapped }) => {
      if (
        mapped.pageStart == null ||
        mapped.pageEnd == null
      )
        return false;
      return (
        mapped.pageStart <= pageNumber &&
        pageNumber <= mapped.pageEnd
      );
    });

  if (
    chunkOverlays.length === 0 &&
    hoveredAnalyzerPage !== pageNumber
  ) {
    return null;
  }

  return (
    <>
      {hoveredAnalyzerPage === pageNumber && (
        <div
          style={{
            position: "absolute",
            inset: 2,
            border: "2px solid rgba(37,99,235,0.95)",
            borderRadius: 8,
            background: "rgba(37,99,235,0.05)",
            pointerEvents: "none",
            zIndex: 5,
          }}
        />
      )}
      {chunkOverlays.map(({ chunk }, idx) => {
        const key = `${chunk.meta.chunkId}:${pageNumber}`;
        const block =
          overlayAnchorByKey[key] ??
          (
            chunk.meta as unknown as {
              bboxList?: Array<{
                x: number;
                y: number;
                w: number;
                h: number;
              }>;
            }
          ).bboxList?.[0];
        const fallbackTop = 0.02 + (idx % 7) * 0.13;
        const top = block
          ? Math.max(0, block.y)
          : fallbackTop;
        const left = block ? Math.max(0, block.x) : 0.06;
        const width = block
          ? Math.max(0.01, block.w)
          : 0.88;
        const height = block
          ? Math.max(0.01, block.h)
          : 0.09;
        const isSelected =
          selectedChunkId === chunk.meta.chunkId;
        return (
          <button
            key={`${chunk.meta.chunkId}-${idx}`}
            type="button"
            onClick={() =>
              onSelectChunk(chunk.meta.chunkId)
            }
            style={{
              position: "absolute",
              left: `${left * 100}%`,
              top: `${top * 100}%`,
              width: `${width * 100}%`,
              height: `${height * 100}%`,
              border: isSelected
                ? "2px solid rgba(249,115,22,0.95)"
                : "2px solid rgba(37,99,235,0.75)",
              background: isSelected
                ? "rgba(249,115,22,0.22)"
                : "rgba(37,99,235,0.10)",
              borderRadius: 6,
              cursor: "pointer",
              zIndex: isSelected ? 9 : 7,
            }}
            title={chunk.text.slice(0, 80)}
          >
            {isSelected && (
              <>
                <div
                  onMouseDown={(event) =>
                    onStartBoundaryDrag(event, {
                      chunkId: chunk.meta.chunkId,
                      pageNumber,
                      handle: "top",
                      y: top,
                      h: height,
                    })
                  }
                  style={dragHandleTop}
                />
                <div
                  onMouseDown={(event) =>
                    onStartBoundaryDrag(event, {
                      chunkId: chunk.meta.chunkId,
                      pageNumber,
                      handle: "bottom",
                      y: top,
                      h: height,
                    })
                  }
                  style={dragHandleBottom}
                />
              </>
            )}
          </button>
        );
      })}
    </>
  );
}

const dragHandleTop = {
  position: "absolute",
  left: "40%",
  right: "40%",
  top: -6,
  height: 8,
  borderRadius: 999,
  background: "#f97316",
  cursor: "ns-resize",
} as const;

const dragHandleBottom = {
  position: "absolute",
  left: "40%",
  right: "40%",
  bottom: -6,
  height: 8,
  borderRadius: 999,
  background: "#f97316",
  cursor: "ns-resize",
} as const;
