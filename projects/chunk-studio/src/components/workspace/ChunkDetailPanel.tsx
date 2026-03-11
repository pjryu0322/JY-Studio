"use client";

import type { Job, JobDetailDTO } from "@/types/job";
import { suggestSplitPoints } from "@/lib/analysis/chunkBoundaryInspector";
import { mapChunkToPage } from "@/lib/analysis/chunkMappingService";
import { useChunkReviewState } from "@/hooks/useChunkReviewState";
import { buildMergedPreview } from "./chunk-review/utils";

interface ChunkDetailPanelProps {
  selectedJob: Job | null;
  detail: JobDetailDTO | null;
  loading: boolean;
  error: string | null;
  showLabels: boolean;
}

export default function ChunkDetailPanel({
  selectedJob,
  detail,
  loading,
  error,
  showLabels,
}: ChunkDetailPanelProps) {
  const state = useChunkReviewState({ selectedJob, detail, loading, error });
  const chunk = state.selectedChunk;

  return (
    <aside className="chunk-review-panel">
      <div className="chunk-review-panel__header">
        {showLabels && <span className="workspace-ui-label">Chunk Detail</span>}
        <strong>Chunk Detail</strong>
      </div>
      <div className="chunk-review-panel__body" style={{ padding: 12 }}>
        {!chunk ? (
          <div style={{ fontSize: 12, color: "#64748b" }}>
            PDF 오버레이에서 청크를 선택해 주세요.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <DetailRow label="chunk id" value={chunk.meta.chunkId} />
            <DetailRow
              label="page range"
              value={`p.${mapChunkToPage(chunk).pageStart ?? "-"} ~ p.${mapChunkToPage(chunk).pageEnd ?? "-"}`}
            />
            <DetailRow label="structure path" value={chunk.meta.sectionPath.join(" > ") || "Unsectioned"} />
            <DetailRow label="section title" value={chunk.meta.sectionTitle ?? "-"} />
            <DetailRow label="status" value={state.selectedStatus ?? "정상"} />
            <div style={contentBox}>
              {chunk.text.slice(0, 500)}
              {chunk.text.length > 500 ? "..." : ""}
            </div>
            {chunk.meta.quality.warnings.length > 0 && (
              <div style={{ fontSize: 11, color: "#b91c1c" }}>
                warnings: {chunk.meta.quality.warnings.slice(0, 4).join(", ")}
              </div>
            )}
            {state.selectedStatus === "짧은 청크" && state.suggestedMergeTarget && (
              <div style={recommendBox}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1e3a8a" }}>추천 병합안</div>
                <div style={{ fontSize: 11, color: "#334155", marginTop: 4 }}>
                  인접 청크 {state.suggestedMergeTarget.meta.chunkId}와 병합을 권장합니다.
                </div>
                <div style={{ ...contentBox, marginTop: 6 }}>
                  {buildMergedPreview(chunk, state.suggestedMergeTarget)}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    state.setMergePairs((prev) => ({
                      ...prev,
                      [chunk.meta.chunkId]: state.suggestedMergeTarget!.meta.chunkId,
                    }));
                    state.markModified(chunk.meta.chunkId);
                    state.markModified(state.suggestedMergeTarget!.meta.chunkId);
                  }}
                  style={actionBtn}
                >
                  추천 병합 적용
                </button>
              </div>
            )}
            <section style={sectionCard}>
              <strong style={{ fontSize: 12, color: "#0f172a" }}>Refinement Actions</strong>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  style={actionBtn}
                  onClick={() => {
                    const index =
                      state.detail?.chunks.findIndex((c) => c.meta.chunkId === chunk.meta.chunkId) ?? -1;
                    const next = index >= 0 ? state.detail?.chunks[index + 1] : null;
                    if (!next) return;
                    state.setMergePairs((prev) => ({ ...prev, [chunk.meta.chunkId]: next.meta.chunkId }));
                    state.markModified(chunk.meta.chunkId);
                    state.markModified(next.meta.chunkId);
                  }}
                >
                  병합
                </button>
                <button
                  type="button"
                  style={actionBtn}
                  onClick={() => {
                    const split = suggestSplitPoints(chunk)[0];
                    state.markModified(chunk.meta.chunkId);
                    state.setReviewNotes((prev) => ({
                      ...prev,
                      [chunk.meta.chunkId]:
                        (prev[chunk.meta.chunkId] ?? "") +
                        `\n[split] 분할 검토 필요${split ? ` (offset ${split.offset})` : ""}`,
                    }));
                  }}
                >
                  분할
                </button>
                <button
                  type="button"
                  style={actionBtn}
                  onClick={() => {
                    state.setExcludedChunkIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(chunk.meta.chunkId)) next.delete(chunk.meta.chunkId);
                      else next.add(chunk.meta.chunkId);
                      return next;
                    });
                    state.markModified(chunk.meta.chunkId);
                  }}
                >
                  제외
                </button>
              </div>
              <label style={{ fontSize: 12, color: "#334155", marginTop: 8, display: "grid", gap: 4 }}>
                레이블 수정
                <input
                  value={state.editedLabels[chunk.meta.chunkId] ?? chunk.meta.sectionTitle ?? ""}
                  onChange={(e) =>
                    state.setEditedLabels((prev) => ({ ...prev, [chunk.meta.chunkId]: e.target.value }))
                  }
                  onBlur={() => state.markModified(chunk.meta.chunkId)}
                  style={input}
                />
              </label>
              <label style={{ fontSize: 12, color: "#334155", marginTop: 8, display: "grid", gap: 4 }}>
                검토 메모
                <textarea
                  rows={3}
                  value={state.reviewNotes[chunk.meta.chunkId] ?? ""}
                  onChange={(e) =>
                    state.setReviewNotes((prev) => ({ ...prev, [chunk.meta.chunkId]: e.target.value }))
                  }
                  onBlur={() => state.markModified(chunk.meta.chunkId)}
                  style={{ ...input, resize: "vertical" }}
                />
              </label>
            </section>
          </div>
        )}
      </div>
    </aside>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 8, fontSize: 12 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ color: "#1f2937" }}>{value}</span>
    </div>
  );
}

const sectionCard = {
  border: "1px solid #dfe5f0",
  borderRadius: 10,
  background: "#fff",
  padding: 10,
} as const;

const recommendBox = {
  border: "1px solid #bfdbfe",
  borderRadius: 8,
  background: "#eff6ff",
  padding: 8,
} as const;

const contentBox = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  background: "#f8fafc",
  padding: 8,
  fontSize: 12,
  color: "#334155",
  whiteSpace: "pre-wrap",
} as const;

const input = {
  width: "100%",
  border: "1px solid #d7deea",
  borderRadius: 7,
  padding: "6px 8px",
  fontSize: 12,
} as const;

const actionBtn = {
  border: "1px solid #d7deea",
  borderRadius: 7,
  background: "#fff",
  padding: "5px 8px",
  fontSize: 11,
  cursor: "pointer",
} as const;
