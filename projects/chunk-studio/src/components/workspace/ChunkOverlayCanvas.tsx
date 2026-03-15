"use client";

/*
 * Overlay-only rendering surface.
 * Draws chunk regions, selection highlight, and boundary drag handles.
 */
import type { MouseEvent as ReactMouseEvent } from "react";
import { useMemo } from "react";
import type { ChunkDTO } from "@/types/job";
import { mapChunkToPage } from "@/lib/analysis/chunkMappingService";

interface DragBoundaryInput {
  chunkId: string;
  pageNumber: number;
  handle: "top" | "bottom";
  x: number;
  y: number;
  w: number;
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
  const chunkOverlays = useMemo(
    () =>
      visibleChunks
        .map((chunk) => ({
          chunk,
          mapped: mapChunkToPage(chunk),
        }))
        .filter(({ mapped }) => {
          if (
            mapped.pageStart == null ||
            mapped.pageEnd == null
          ) {
            return false;
          }
          return (
            mapped.pageStart <= pageNumber &&
            pageNumber <= mapped.pageEnd
          );
        })
        .sort((a, b) =>
          a.chunk.meta.chunkId.localeCompare(
            b.chunk.meta.chunkId,
          ),
        ),
    [pageNumber, visibleChunks],
  );

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
      {chunkOverlays.map(({ chunk }) => {
        const key = `${chunk.meta.chunkId}:${pageNumber}`;
        const anchorBlock = overlayAnchorByKey[key];
        const metaBlock = (
          chunk.meta as unknown as {
            bboxList?: Array<{
              x: number;
              y: number;
              w: number;
              h: number;
            }>;
          }
        ).bboxList?.[0];
        const block = anchorBlock ?? metaBlock;
        const fallback = buildStableFallback(
          chunk.meta.chunkId,
          pageNumber,
        );
        const baseRect = block
          ? {
              x: block.x,
              y: block.y,
              w: block.w,
              h: block.h,
            }
          : fallback;
        const rect = clampRect(baseRect);
        const isSelected =
          selectedChunkId === chunk.meta.chunkId;
        return (
          <button
            key={`${chunk.meta.chunkId}-${pageNumber}`}
            type="button"
            onClick={() =>
              onSelectChunk(chunk.meta.chunkId)
            }
            style={{
              position: "absolute",
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.w * 100}%`,
              height: `${rect.h * 100}%`,
              border: isSelected
                ? "2px solid rgba(249,115,22,0.95)"
                : "2px solid rgba(37,99,235,0.75)",
              background: isSelected
                ? "rgba(249,115,22,0.20)"
                : "rgba(37,99,235,0.08)",
              borderRadius: 6,
              cursor: "pointer",
              zIndex: isSelected ? 9 : 7,
              boxShadow: isSelected
                ? "0 0 0 1px rgba(249,115,22,0.45), 0 6px 16px rgba(15,23,42,0.18)"
                : "0 1px 4px rgba(15,23,42,0.10)",
              opacity: isSelected ? 1 : 0.78,
              transition:
                "left 80ms linear, top 80ms linear, width 80ms linear, height 80ms linear, opacity 120ms ease, box-shadow 120ms ease",
            }}
            title={chunk.text.slice(0, 80)}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                borderTop: isSelected
                  ? "2px solid rgba(249,115,22,0.95)"
                  : "2px solid rgba(37,99,235,0.75)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                borderBottom: isSelected
                  ? "2px dashed rgba(249,115,22,0.85)"
                  : "2px dashed rgba(37,99,235,0.55)",
              }}
            />
            {isSelected && (
              <>
                <div
                  onMouseDown={(event) =>
                    onStartBoundaryDrag(event, {
                      chunkId: chunk.meta.chunkId,
                      pageNumber,
                      handle: "top",
                      x: rect.x,
                      y: rect.y,
                      w: rect.w,
                      h: rect.h,
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
                      x: rect.x,
                      y: rect.y,
                      w: rect.w,
                      h: rect.h,
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
  left: "38%",
  right: "38%",
  top: -6,
  height: 10,
  borderRadius: 999,
  background: "#f97316",
  cursor: "ns-resize",
  zIndex: 12,
} as const;

const dragHandleBottom = {
  position: "absolute",
  left: "38%",
  right: "38%",
  bottom: -6,
  height: 10,
  borderRadius: 999,
  background: "#f97316",
  cursor: "ns-resize",
  zIndex: 12,
} as const;

function buildStableFallback(
  chunkId: string,
  pageNumber: number,
) {
  const hash = stableHash(`${chunkId}:${pageNumber}`);
  const lane = hash % 6;
  const y = 0.04 + lane * 0.14;
  const height = 0.11 + ((hash >> 3) % 3) * 0.02;
  return clampRect({
    x: 0.06,
    y,
    w: 0.88,
    h: height,
  });
}

function stableHash(value: string): number {
  let hash = 0;
  for (let idx = 0; idx < value.length; idx += 1) {
    hash = (hash * 31 + value.charCodeAt(idx)) >>> 0;
  }
  return hash;
}

function clampRect(rect: {
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  const x = clamp(rect.x, 0.01, 0.95);
  const y = clamp(rect.y, 0.01, 0.95);
  const maxW = Math.max(0.01, 0.99 - x);
  const maxH = Math.max(0.01, 0.99 - y);
  const w = clamp(rect.w, 0.01, maxW);
  const h = clamp(rect.h, 0.01, maxH);
  return { x, y, w, h };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
