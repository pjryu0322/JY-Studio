"use client";

/*
 * Inspector-only UI.
 * Shows selected chunk details and edit action entry points.
 */
import type { ChunkDTO } from "@/types/job";
import { useMemo } from "react";
import { mapChunkToPage } from "@/lib/analysis/chunkMappingService";
import { evaluateChunkQuality } from "@/lib/chunking/quality/chunkQualityScore";

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
  onEditReviewNote: (
    chunkId: string,
    value: string,
  ) => void;
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
  const qualityMetrics = useMemo(
    () =>
      selectedChunk
        ? evaluateChunkQuality(selectedChunk)
        : null,
    [selectedChunk],
  );
  const qualityTone = qualityMetrics
    ? getQualityTone(qualityMetrics.qualityScore)
    : null;

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
            selectedChunk?.meta.chunkId ===
            chunk.meta.chunkId;
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
              <strong
                style={{ fontSize: 12, color: "#0f172a" }}
              >
                {chunk.meta.chunkId}
              </strong>
              <span
                style={{ fontSize: 11, color: "#64748b" }}
              >
                page {mapped.pageStart ?? "-"}~
                {mapped.pageEnd ?? "-"}
              </span>
              <span
                style={{ fontSize: 11, color: "#334155" }}
              >
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
            boundary drag: 오버레이 상/하단 주황 핸들을
            드래그해 경계를 조정하세요.
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            ai suggestion: {suggestion}
          </div>
          {qualityMetrics && qualityTone && (
            <div
              style={{
                border: "1px solid #dbe3f1",
                borderRadius: 8,
                padding: 8,
                display: "grid",
                gap: 6,
                background: "#f8fafc",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "#334155",
                    fontWeight: 700,
                  }}
                >
                  retrieval quality
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "#fff",
                    background: qualityTone.color,
                    borderRadius: 999,
                    padding: "2px 8px",
                    fontWeight: 700,
                  }}
                >
                  {Math.round(
                    qualityMetrics.qualityScore * 100,
                  )}
                  %
                </span>
              </div>
              <MetricRow
                label="quality score"
                value={qualityMetrics.qualityScore}
                color={qualityTone.color}
              />
              <MetricRow
                label="boundary score"
                value={qualityMetrics.boundaryScore}
                color="#2563eb"
              />
              <MetricRow
                label="noise score"
                value={qualityMetrics.noiseScore}
                color="#dc2626"
              />
              <MetricRow
                label="structure score"
                value={qualityMetrics.structureScore}
                color="#7c3aed"
              />
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
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
              onEditLabel(
                selectedChunk.meta.chunkId,
                e.target.value,
              )
            }
            placeholder="label edit"
            style={selector}
          />
          <textarea
            value={
              reviewNotes[selectedChunk.meta.chunkId] ?? ""
            }
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

function MetricRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <div
      style={{
        display: "grid",
        gap: 4,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "#475569",
        }}
      >
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: "#e2e8f0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
          }}
        />
      </div>
    </div>
  );
}

function getQualityTone(score: number): {
  level: "good" | "acceptable" | "poor";
  color: string;
} {
  if (score >= 0.75) {
    return { level: "good", color: "#16a34a" };
  }
  if (score >= 0.55) {
    return { level: "acceptable", color: "#d97706" };
  }
  return { level: "poor", color: "#dc2626" };
}
