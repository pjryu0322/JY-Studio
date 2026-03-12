"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChunkDTO } from "@/types/job";
import type { PageType } from "./pageTypeClassifier";

interface ChunkOverlayLayerProps {
  chunks: ChunkDTO[];
  pageNumber: number;
  pageSize: { width: number; height: number };
  selectedChunkId: string | null;
  boundaryRatios?: number[];
  onBoundaryRatiosChange?: (ratios: number[]) => void;
  onSelectChunk: (chunk: ChunkDTO) => void;
  onHoverChunk?: (chunkId: string | null) => void;
  onChunkAnchorChange?: (anchor: { x: number; y: number }) => void;
  onHoverAnchorChange?: (anchor: { x: number; y: number } | null) => void;
  chunkAnchors?: Record<string, { top: number; bottom: number; left: number; right: number }>;
  selectedTextBlocks?: Array<{ x: number; y: number; width: number; height: number }>;
  pageType?: PageType;
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
  onChunkAnchorChange,
  onHoverAnchorChange,
  chunkAnchors,
  selectedTextBlocks,
  pageType = "body",
}: ChunkOverlayLayerProps) {
  const [hoveredChunkId, setHoveredChunkId] = useState<string | null>(null);
  const [draggingBoundaryIndex, setDraggingBoundaryIndex] = useState<number | null>(null);
  const [hoveredBoundaryIndex, setHoveredBoundaryIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const filtered = chunks
    .filter((chunk) => {
      const pageRange = (chunk.meta as unknown as { pageRange?: [number, number] }).pageRange;
      // Some fallback/extracted chunks can miss pageRange metadata.
      // In that case, keep overlays visible across pages instead of hiding them.
      if (!Array.isArray(pageRange) || pageRange.length !== 2) return true;
      return pageNumber >= pageRange[0] && pageNumber <= pageRange[1];
    })
    .sort((a, b) => a.meta.startBlockIdx - b.meta.startBlockIdx);
  const visible = adaptVisibleChunks(filtered, pageType);
  const canDragBoundary = pageType === "body";
  const hasVisible = visible.length > 0;
  const minStart = hasVisible ? Math.min(...visible.map((chunk) => chunk.meta.startBlockIdx)) : 0;
  const maxEnd = hasVisible ? Math.max(...visible.map((chunk) => chunk.meta.endBlockIdx)) : 1;
  const span = Math.max(1, maxEnd - minStart + 1);

  const basePositioned = visible.map((chunk, index) => {
    const startRatioByBlock = (chunk.meta.startBlockIdx - minStart) / span;
    const endRatioByBlock = (chunk.meta.endBlockIdx - minStart + 1) / span;
    const anchor = chunkAnchors?.[chunk.meta.chunkId];
    const startRatio = anchor
      ? clamp(anchor.top / pageSize.height, 0, 0.99)
      : startRatioByBlock;
    const endRatio = anchor
      ? clamp(anchor.bottom / pageSize.height, startRatio + 0.01, 1)
      : endRatioByBlock;
    const pad = pageType === "table" ? 4 : 6;
    const fallbackInsetRatio =
      pageType === "cover"
        ? 0.18
        : pageType === "table" || pageType === "revision_or_form"
          ? 0.06
          : 0.12;
    const fallbackSideInset = Math.max(18, Math.floor(pageSize.width * fallbackInsetRatio));
    const leftInset = anchor
      ? clamp(anchor.left - pad, 8, Math.max(8, pageSize.width - 60))
      : chunk.meta.type === "table"
        ? Math.max(18, fallbackSideInset - 10)
        : fallbackSideInset;
    const rightInset = anchor
      ? clamp(pageSize.width - (anchor.right + pad), 8, Math.max(8, pageSize.width - leftInset - 40))
      : leftInset;
    return { chunk, index, startRatio, endRatio, leftInset, rightInset };
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
  const positioned = visible.map((chunk, index) => {
    const base = basePositioned[index];
    return {
      chunk,
      index,
      startRatio: index === 0 ? 0 : activeBoundaries[index - 1],
      endRatio: index === visible.length - 1 ? 1 : activeBoundaries[index],
      leftInset: base?.leftInset ?? 8,
      rightInset: base?.rightInset ?? 8,
    };
  });
  const boundaryLines = useMemo(
    () => positioned.slice(0, -1).map((item) => item.endRatio),
    [positioned]
  );
  const snapRatios = useMemo(() => {
    if (!chunkAnchors) return [] as number[];
    const values = Object.values(chunkAnchors)
      .flatMap((anchor) => [anchor.top / pageSize.height, anchor.bottom / pageSize.height])
      .map((ratio) => clamp(ratio, 0.02, 0.98));
    return Array.from(new Set(values.map((ratio) => Number(ratio.toFixed(4))))).sort((a, b) => a - b);
  }, [chunkAnchors, pageSize.height]);
  const snapThreshold = pageType === "table" || pageType === "revision_or_form" ? 0.012 : 0.018;
  const selectedIndex = positioned.findIndex((item) => item.chunk.meta.chunkId === selectedChunkId);
  const boundaryLeft = positioned.length > 0 ? Math.min(...positioned.map((item) => item.leftInset)) : 8;
  const boundaryRight = positioned.length > 0 ? Math.min(...positioned.map((item) => item.rightInset)) : 8;

  useEffect(() => {
    if (!canDragBoundary) return;
    if (draggingBoundaryIndex == null) return;
    const onMove = (event: MouseEvent) => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect || !onBoundaryRatiosChange) return;
      const ratio = clamp((event.clientY - rect.top) / rect.height, 0.02, 0.98);
      const snappedRatio =
        snapRatios.length > 0 ? nearestSnapRatio(ratio, snapRatios, snapThreshold) : ratio;
      const next = [...activeBoundaries];
      const minGap = 0.02;
      const lower = draggingBoundaryIndex === 0 ? minGap : next[draggingBoundaryIndex - 1] + minGap;
      const upper =
        draggingBoundaryIndex === next.length - 1
          ? 1 - minGap
          : next[draggingBoundaryIndex + 1] - minGap;
      next[draggingBoundaryIndex] = clamp(snappedRatio, lower, upper);
      onBoundaryRatiosChange(next);
    };
    const onUp = () => setDraggingBoundaryIndex(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  });

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
      {selectedTextBlocks?.map((block, idx) => (
        <div
          key={`selected-text-${idx}`}
          style={{
            position: "absolute",
            left: block.x - 2,
            top: block.y - 1,
            width: block.width + 4,
            height: block.height + 2,
            background: "rgba(250,204,21,0.25)",
            border: "1px solid rgba(250,204,21,0.45)",
            borderRadius: 4,
            pointerEvents: "none",
            zIndex: 9,
          }}
        />
      ))}
      {positioned.map(({ chunk, index, startRatio, endRatio }) => {
        const top = Math.max(2, Math.floor(startRatio * pageSize.height));
        const bottom = Math.max(top + 18, Math.floor(endRatio * pageSize.height) - 2);
        const regionHeight = bottom - top;
        const isHovered = hoveredChunkId === chunk.meta.chunkId;
        const isSelected = selectedChunkId === chunk.meta.chunkId;
        const hasActiveSelection = Boolean(selectedChunkId);
        const heat = heatStyle(chunk);
        const pageLabel = toPageLabel(chunk);
        const sectionLabel = chunk.meta.sectionTitle || chunk.meta.sectionPath.at(-1) || "섹션 미지정";
        const previewText = representativeSentence(chunk.text);
        const compact = regionHeight < (pageType === "table" ? 66 : 84);
        const leftInset = positioned[index]?.leftInset ?? 8;
        const rightInset = positioned[index]?.rightInset ?? 8;
        return (
          <button
            key={chunk.meta.chunkId}
            type="button"
            onClick={(event) => {
              onSelectChunk(chunk);
              const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
              onChunkAnchorChange?.({
                x: rect.right + 12,
                y: rect.top + 8,
              });
            }}
            onMouseEnter={() => {
              setHoveredChunkId(chunk.meta.chunkId);
              onHoverChunk?.(chunk.meta.chunkId);
              const rect = rootRef.current?.getBoundingClientRect();
              if (!rect) return;
              onHoverAnchorChange?.({
                x: rect.left + leftInset + 12,
                y: rect.top + top + 10,
              });
            }}
            onMouseLeave={() => {
              setHoveredChunkId(null);
              onHoverChunk?.(null);
              onHoverAnchorChange?.(null);
            }}
            style={{
              textAlign: "left",
              position: "absolute",
              left: leftInset,
              right: rightInset,
              top,
              height: regionHeight,
              pointerEvents: "auto",
              border: isSelected
                ? "2px solid rgba(249,115,22,0.95)"
                : `2px solid ${heat.border}`,
              borderRadius: 8,
              padding: "4px 6px",
              background: isSelected
                ? "rgba(249,115,22,0.20)"
                : isHovered
                  ? heat.hover
                  : heat.fill,
              color: "#1e3a8a",
              fontSize: 10,
              cursor: "pointer",
              boxShadow: isSelected ? "0 0 0 1px rgba(249,115,22,0.25) inset" : undefined,
              overflow: "hidden",
              opacity: hasActiveSelection && !isSelected ? 0.48 : 1,
              filter: hasActiveSelection && !isSelected ? "saturate(0.85)" : "none",
              transition: "opacity 120ms ease, filter 120ms ease",
            }}
            title={chunk.meta.sectionPath.join(" > ") || "Unsectioned"}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
              <div style={{ fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                {sectionLabel}
              </div>
              <div
                style={{
                  border: "1px solid rgba(148,163,184,0.45)",
                  borderRadius: 999,
                  padding: "1px 6px",
                  fontSize: 9,
                  color: "#334155",
                  background: "rgba(255,255,255,0.62)",
                  flexShrink: 0,
                }}
              >
                {pageLabel}
              </div>
            </div>
            {!compact && (
              <>
                <div
                  style={{
                    marginTop: 1,
                    color: "#334155",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                  }}
                >
                  {previewText}
                </div>
                <div style={{ marginTop: 1, fontSize: 9, color: "#475569" }}>
                  chunk #{index + 1}
                </div>
              </>
            )}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                borderTop: isSelected
                  ? "2px solid rgba(249,115,22,0.95)"
                  : "2px solid rgba(37,99,235,0.95)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                borderBottom: isSelected
                  ? "1px dashed rgba(249,115,22,0.95)"
                  : "1px dashed rgba(37,99,235,0.9)",
              }}
            />
          </button>
        );
      })}
      {boundaryLines.map((ratio, index) => (
        <div
          key={`boundary-${index}`}
          onMouseDown={() => {
            if (!canDragBoundary) return;
            setDraggingBoundaryIndex(index);
          }}
          onMouseEnter={() => setHoveredBoundaryIndex(index)}
          onMouseLeave={() => setHoveredBoundaryIndex((prev) => (prev === index ? null : prev))}
          style={{
            position: "absolute",
            left: boundaryLeft,
            right: boundaryRight,
            top: Math.floor(ratio * pageSize.height),
            borderTop:
              draggingBoundaryIndex === index
                ? "3px solid rgba(249,115,22,0.95)"
                : hoveredBoundaryIndex === index
                  ? "3px dashed rgba(37,99,235,0.95)"
                  : selectedIndex >= 0 && (index === selectedIndex || index === selectedIndex - 1)
                    ? "2px dashed rgba(249,115,22,0.88)"
                    : "2px dashed rgba(15,23,42,0.55)",
            cursor: canDragBoundary ? "ns-resize" : "default",
            pointerEvents: canDragBoundary ? "auto" : "none",
            zIndex: 12,
          }}
          title={canDragBoundary ? "Drag boundary" : "Boundary drag disabled for this page type"}
        />
      ))}
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function heatStyle(chunk: ChunkDTO) {
  const state = qualityState(chunk);
  if (state === "too-short") {
    return {
      border: "rgba(220,38,38,0.78)",
      fill: "rgba(220,38,38,0.10)",
      hover: "rgba(220,38,38,0.18)",
    };
  }
  if (state === "too-long") {
    return {
      border: "rgba(234,88,12,0.8)",
      fill: "rgba(251,146,60,0.12)",
      hover: "rgba(251,146,60,0.2)",
    };
  }
  if (state === "review") {
    return {
      border: "rgba(202,138,4,0.78)",
      fill: "rgba(250,204,21,0.10)",
      hover: "rgba(250,204,21,0.18)",
    };
  }
  return {
    border: "rgba(22,163,74,0.78)",
    fill: "rgba(22,163,74,0.10)",
    hover: "rgba(22,163,74,0.18)",
  };
}

function qualityState(chunk: ChunkDTO): "good" | "review" | "too-short" | "too-long" {
  const tokens = chunk.meta.quality?.tokens ?? Math.floor(chunk.text.length / 4);
  if (tokens < 80) return "too-short";
  if (tokens > 900) return "too-long";
  if (tokens < 150) return "review";
  return "good";
}

function toPageLabel(chunk: ChunkDTO): string {
  const range = (chunk.meta as unknown as { pageRange?: [number, number] }).pageRange;
  if (!Array.isArray(range) || range.length !== 2) return "p.-";
  if (range[0] === range[1]) return `p.${range[0]}`;
  return `p.${range[0]}-${range[1]}`;
}

function representativeSentence(text: string): string {
  const normalized = normalizePreviewText(text);
  if (!normalized) return "내용 미리보기를 불러오지 못했습니다.";
  const sentence = normalized.split(/(?<=[.!?。])\s+/)[0] ?? normalized;
  const compact = sentence.replace(/\s+/g, " ").trim();
  if (compact.length <= 58) return compact;
  return `${compact.slice(0, 58)}...`;
}

function nearestSnapRatio(target: number, snapRatios: number[], threshold: number): number {
  if (snapRatios.length === 0) return target;
  let nearest = snapRatios[0];
  let minDist = Math.abs(target - nearest);
  for (let i = 1; i < snapRatios.length; i += 1) {
    const dist = Math.abs(target - snapRatios[i]);
    if (dist < minDist) {
      minDist = dist;
      nearest = snapRatios[i];
    }
  }
  // Keep slight free movement unless close to text anchor.
  return minDist <= threshold ? nearest : target;
}

function adaptVisibleChunks(chunks: ChunkDTO[], pageType: PageType): ChunkDTO[] {
  if (chunks.length === 0) return [];
  if (pageType === "cover") return chunks.slice(0, 2);
  if (pageType === "toc") return chunks.slice(0, 60);
  if (pageType === "table") return chunks.slice(0, 80);
  if (pageType === "revision_or_form") return chunks.slice(0, 40);
  return chunks.slice(0, 45);
}

function normalizePreviewText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+\n/g, "\n")
    .trim();
}
