"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChunkDTO, Job, JobDetailDTO } from "@/types/job";
import {
  analyzeChunkQualityBatch,
  type ChunkQualityStatus,
} from "@/lib/analysis/chunkQualityAnalyzer";
import {
  highlightChunkInPreview,
  mapChunkToPage,
} from "@/lib/analysis/chunkMappingService";
import { suggestSplitPoints } from "@/lib/analysis/chunkBoundaryInspector";
import type { RagRefinementPayload } from "@/lib/analysis/ragExportOptimizer";

interface JobDetailProps {
  selectedJob: Job | null;
  detail: JobDetailDTO | null;
  loading: boolean;
  error: string | null;
}

export default function JobDetail({
  selectedJob,
  detail,
  loading,
  error,
}: JobDetailProps) {
  const job = selectedJob;
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [filter, setFilter] = useState<
    "all" | "needs-review" | "edited" | "noise" | "long" | "short"
  >("all");
  const [search, setSearch] = useState("");
  const [editedLabels, setEditedLabels] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [modifiedChunkIds, setModifiedChunkIds] = useState<Set<string>>(new Set());
  const [excludedChunkIds, setExcludedChunkIds] = useState<Set<string>>(new Set());
  const [mergePairs, setMergePairs] = useState<Record<string, string>>({});
  const [sectionFilter, setSectionFilter] = useState<string | null>(null);
  const statusGroup = useMemo(() => {
    if (!job?.status) return "idle";
    if (job.status === "FAILED") return "failed";
    if (job.status === "DONE") return "done";
    if (
      ["QUEUED", "CONVERTING", "PDF_READY", "EXTRACTING_TEXT", "CHUNKING"].includes(
        job.status
      )
    ) {
      return "processing";
    }
    return "idle";
  }, [job?.status]);
  const processingMessage = useMemo(() => {
    if (job?.status === "QUEUED") return "문서를 분석 대기 중입니다.";
    return "문서를 분석 중입니다.";
  }, [job?.status]);

  useEffect(() => {
    if (!job) return;
    const payload: RagRefinementPayload & { jobId: string } = {
      jobId: job.id,
      editedLabels,
      reviewNotes,
      excludedChunkIds: Array.from(excludedChunkIds),
      mergePairs,
      modifiedChunkIds: Array.from(modifiedChunkIds),
    };
    window.dispatchEvent(
      new CustomEvent("chunkstudio:refinements-changed", { detail: payload })
    );
  }, [editedLabels, excludedChunkIds, job, mergePairs, modifiedChunkIds, reviewNotes]);

  const indexedChunks = useMemo(
    () =>
      (detail?.chunks ?? []).map((chunk, index) => ({
        chunk,
        index,
        quality: analyzeChunkQualityBatch([chunk])[0],
      })),
    [detail]
  );

  const filteredChunks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return indexedChunks.filter(({ chunk, quality }) => {
      const status = resolveUiStatus(chunk, quality.status, modifiedChunkIds);
      const matchSearch = !q
        ? true
        : chunk.text.toLowerCase().includes(q) ||
          chunk.meta.chunkId.toLowerCase().includes(q) ||
          chunk.meta.sectionPath.join(" > ").toLowerCase().includes(q) ||
          (chunk.meta.sectionTitle ?? "").toLowerCase().includes(q);
      const matchFilter =
        filter === "all"
          ? true
          : filter === "needs-review"
            ? status === "검토 필요"
            : filter === "edited"
              ? status === "수정됨"
              : filter === "noise"
                ? status === "노이즈 의심"
                : filter === "long"
                  ? status === "긴 청크"
                  : status === "짧은 청크";
      const chunkSection = chunk.meta.sectionPath.join(" > ") || "Unsectioned";
      const matchSection = !sectionFilter || chunkSection === sectionFilter;
      return matchSearch && matchFilter && matchSection;
    });
  }, [filter, indexedChunks, modifiedChunkIds, search, sectionFilter]);

  const selectedEntry = useMemo(() => {
    const resolvedSelectedId = selectedChunkId ?? detail?.chunks?.[0]?.meta.chunkId ?? null;
    return (
      filteredChunks.find(({ chunk }) => chunk.meta.chunkId === resolvedSelectedId) ??
      filteredChunks[0] ??
      null
    );
  }, [detail, filteredChunks, selectedChunkId]);
  const selectedChunk = selectedEntry?.chunk ?? null;
  const selectedQuality = selectedChunk
    ? analyzeChunkQualityBatch([selectedChunk])[0]
    : null;
  const selectedStatus = selectedChunk
    ? resolveUiStatus(selectedChunk, selectedQuality?.status ?? "NORMAL", modifiedChunkIds)
    : null;
  const suggestedMergeTarget = useMemo(
    () => (selectedChunk && detail?.chunks ? findMergeTarget(selectedChunk, detail.chunks) : null),
    [detail, selectedChunk]
  );

  useEffect(() => {
    const onSelectedSection = (e: Event) => {
      const custom = e as CustomEvent<string>;
      const section = typeof custom.detail === "string" ? custom.detail : "";
      setSectionFilter(section || null);
    };
    window.addEventListener("chunkstudio:selected-section", onSelectedSection as EventListener);
    return () =>
      window.removeEventListener(
        "chunkstudio:selected-section",
        onSelectedSection as EventListener
      );
  }, []);

  useEffect(() => {
    const onSelectedChunk = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (typeof custom.detail === "string") {
        setSelectedChunkId(custom.detail);
      }
    };
    window.addEventListener("chunkstudio:selected-chunk", onSelectedChunk as EventListener);
    return () =>
      window.removeEventListener(
        "chunkstudio:selected-chunk",
        onSelectedChunk as EventListener
      );
  }, []);

  if (!job) {
    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600 }}>Chunk Review</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#666" }}>PDF를 업로드해 주세요.</p>
      </div>
    );
  }

  const selectChunk = (chunk: ChunkDTO) => {
    setSelectedChunkId(chunk.meta.chunkId);
    window.dispatchEvent(
      new CustomEvent("chunkstudio:selected-chunk", { detail: chunk.meta.chunkId })
    );
    highlightChunkInPreview(chunk);
  };

  const markModified = (chunkId: string) => {
    setModifiedChunkIds((prev) => {
      const next = new Set(prev);
      next.add(chunkId);
      return next;
    });
  };

  return (
    <div style={{ padding: 16, height: "100%", boxSizing: "border-box" }}>
      <section style={{ border: "1px solid #dfe5f0", borderRadius: 10, background: "#fff", padding: 10 }}>
        <strong style={{ fontSize: 13, color: "#0f172a" }}>A. Chunk List</strong>
        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="청크 검색 (ID/섹션/텍스트)"
            style={{ width: "100%", border: "1px solid #d7deea", borderRadius: 8, padding: "6px 8px", fontSize: 12 }}
          />
          {sectionFilter && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                border: "1px solid #d7deea",
                borderRadius: 8,
                padding: "5px 8px",
                background: "#f8fafc",
                fontSize: 11,
                color: "#475569",
              }}
            >
              <span>구조 필터: {sectionFilter}</span>
              <button
                type="button"
                onClick={() => setSectionFilter(null)}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  background: "#fff",
                  fontSize: 10,
                  padding: "2px 6px",
                  cursor: "pointer",
                }}
              >
                해제
              </button>
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[
              { id: "all", label: "전체" },
              { id: "needs-review", label: "검토 필요" },
              { id: "edited", label: "수정됨" },
              { id: "noise", label: "노이즈 의심" },
              { id: "long", label: "긴 청크" },
              { id: "short", label: "짧은 청크" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id as typeof filter)}
                style={{
                  border: filter === item.id ? "1px solid #3b82f6" : "1px solid #d7deea",
                  borderRadius: 999,
                  background: filter === item.id ? "#eaf2ff" : "#fff",
                  color: filter === item.id ? "#1d4ed8" : "#475569",
                  fontSize: 11,
                  padding: "4px 8px",
                  cursor: "pointer",
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 10, display: "grid", gap: 6, maxHeight: 320, overflow: "auto" }}>
          {filteredChunks.map(({ chunk, index, quality }) => {
            const { pageStart: startPage, pageEnd: endPage } = mapChunkToPage(chunk);
            const isSelected = selectedChunkId === chunk.meta.chunkId;
            const status = resolveUiStatus(chunk, quality.status, modifiedChunkIds);
            return (
              <button
                key={chunk.meta.chunkId || `chunk-${index}`}
                type="button"
                onClick={() => selectChunk(chunk)}
                style={{
                  textAlign: "left",
                  border: isSelected ? "1px solid #3b82f6" : "1px solid #e2e8f0",
                  borderRadius: 8,
                  background: isSelected ? "#eff6ff" : "#fff",
                  padding: 8,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ fontSize: 11, color: "#1f2937" }}>
                    #{index + 1} {chunk.meta.sectionTitle || chunk.meta.sectionPath.at(-1) || "Untitled"}
                  </strong>
                  <StatusBadge status={status} />
                </div>
                <div style={{ marginTop: 3, fontSize: 11, color: "#475569" }}>
                  p.{startPage ?? "-"}~{endPage ?? "-"} /{" "}
                  {(chunk.meta.sectionPath.join(" > ") || "Unsectioned").slice(0, 44)}
                </div>
                <div style={{ marginTop: 4, fontSize: 11, color: "#64748b" }}>
                  {chunk.text.slice(0, 90)}{chunk.text.length > 90 ? "..." : ""}
                </div>
                {status === "짧은 청크" && (
                  <div style={{ marginTop: 4, fontSize: 10, color: "#1d4ed8" }}>
                    추천: 인접 청크와 병합 검토
                  </div>
                )}
              </button>
            );
          })}
          {filteredChunks.length === 0 && (
            <div style={{ fontSize: 12, color: "#64748b", padding: 8 }}>
              {detail?.chunks?.length
                ? "조건에 맞는 청크가 없습니다."
                : loading || statusGroup === "processing"
                  ? processingMessage
                  : statusGroup === "failed"
                    ? "문서 분석에 실패했습니다."
                  : error
                    ? error
                    : "청크가 아직 생성되지 않았습니다."}
            </div>
          )}
        </div>
      </section>

      <section style={{ marginTop: 10, border: "1px solid #dfe5f0", borderRadius: 10, background: "#fff", padding: 10 }}>
        <strong style={{ fontSize: 13, color: "#0f172a" }}>B. Selected Chunk Detail</strong>
        {!selectedChunk ? (
          <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
            {loading || statusGroup === "processing"
              ? processingMessage
              : error
                ? error
              : "선택된 청크가 없습니다."}
          </div>
        ) : (
          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            <Row label="chunk id" value={selectedChunk.meta.chunkId} />
            <Row
              label="page range"
              value={`p.${mapChunkToPage(selectedChunk).pageStart ?? "-"} ~ p.${mapChunkToPage(selectedChunk).pageEnd ?? "-"}`}
            />
            <Row label="structure path" value={selectedChunk.meta.sectionPath.join(" > ") || "Unsectioned"} />
            <Row label="section title" value={selectedChunk.meta.sectionTitle ?? "-"} />
            <Row label="status" value={selectedStatus ?? "정상"} />
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", padding: 8, fontSize: 12, color: "#334155", whiteSpace: "pre-wrap" }}>
              {selectedChunk.text.slice(0, 560)}{selectedChunk.text.length > 560 ? "..." : ""}
            </div>
            {selectedStatus === "짧은 청크" && suggestedMergeTarget && (
              <div style={{ border: "1px solid #bfdbfe", borderRadius: 8, background: "#eff6ff", padding: 8 }}>
                <div style={{ fontSize: 12, color: "#1e3a8a", fontWeight: 700 }}>추천 청킹(최적안)</div>
                <div style={{ marginTop: 4, fontSize: 11, color: "#334155" }}>
                  현재 청크가 짧아 인접 청크 <strong>{suggestedMergeTarget.meta.chunkId}</strong> 와
                  병합하는 것을 권장합니다.
                </div>
                <div
                  style={{
                    marginTop: 6,
                    border: "1px solid #dbeafe",
                    borderRadius: 6,
                    background: "#fff",
                    padding: 6,
                    fontSize: 11,
                    color: "#334155",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {buildMergedPreview(selectedChunk, suggestedMergeTarget)}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMergePairs((prev) => ({
                      ...prev,
                      [selectedChunk.meta.chunkId]: suggestedMergeTarget.meta.chunkId,
                    }));
                    markModified(selectedChunk.meta.chunkId);
                    markModified(suggestedMergeTarget.meta.chunkId);
                  }}
                  style={{ ...actionBtn, marginTop: 8 }}
                >
                  추천 병합안 적용
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => selectChunk(selectedChunk)}
              style={{ justifySelf: "start", fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}
            >
              PDF 위치로 이동
            </button>
          </div>
        )}
      </section>

      <section style={{ marginTop: 10, border: "1px solid #dfe5f0", borderRadius: 10, background: "#fff", padding: 10 }}>
        <strong style={{ fontSize: 13, color: "#0f172a" }}>C. Refinement Actions</strong>
        {!selectedChunk ? (
          <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>청크를 먼저 선택하세요.</div>
        ) : (
          <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <button
                type="button"
                onClick={() => {
                  const currentIndex = detail?.chunks.findIndex((c) => c.meta.chunkId === selectedChunk.meta.chunkId) ?? -1;
                  const nextChunk = currentIndex >= 0 ? detail?.chunks[currentIndex + 1] : null;
                  if (!nextChunk) return;
                  setMergePairs((prev) => ({ ...prev, [selectedChunk.meta.chunkId]: nextChunk.meta.chunkId }));
                  markModified(selectedChunk.meta.chunkId);
                  markModified(nextChunk.meta.chunkId);
                }}
                style={actionBtn}
              >
                병합
              </button>
              <button
                type="button"
                onClick={() => {
                  const split = suggestSplitPoints(selectedChunk)[0];
                  markModified(selectedChunk.meta.chunkId);
                  setReviewNotes((prev) => ({
                    ...prev,
                    [selectedChunk.meta.chunkId]:
                      (prev[selectedChunk.meta.chunkId] ?? "") +
                      `\n[split] 분할 검토 필요${split ? ` (offset ${split.offset})` : ""}`,
                  }));
                }}
                style={actionBtn}
              >
                분할
              </button>
              <button
                type="button"
                onClick={() => {
                  setExcludedChunkIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(selectedChunk.meta.chunkId)) next.delete(selectedChunk.meta.chunkId);
                    else next.add(selectedChunk.meta.chunkId);
                    return next;
                  });
                  markModified(selectedChunk.meta.chunkId);
                }}
                style={actionBtn}
              >
                제외
              </button>
            </div>
            <label style={{ fontSize: 12, color: "#334155" }}>
              레이블 수정
              <input
                value={editedLabels[selectedChunk.meta.chunkId] ?? selectedChunk.meta.sectionTitle ?? ""}
                onChange={(e) =>
                  setEditedLabels((prev) => ({ ...prev, [selectedChunk.meta.chunkId]: e.target.value }))
                }
                onBlur={() => markModified(selectedChunk.meta.chunkId)}
                style={{ marginTop: 4, width: "100%", border: "1px solid #d7deea", borderRadius: 7, padding: "6px 8px", fontSize: 12 }}
              />
            </label>
            <label style={{ fontSize: 12, color: "#334155" }}>
              검토 메모
              <textarea
                value={reviewNotes[selectedChunk.meta.chunkId] ?? ""}
                onChange={(e) =>
                  setReviewNotes((prev) => ({ ...prev, [selectedChunk.meta.chunkId]: e.target.value }))
                }
                onBlur={() => markModified(selectedChunk.meta.chunkId)}
                rows={3}
                style={{ marginTop: 4, width: "100%", border: "1px solid #d7deea", borderRadius: 7, padding: "6px 8px", fontSize: 12, resize: "vertical" }}
              />
            </label>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              수정 상태: {modifiedChunkIds.has(selectedChunk.meta.chunkId) ? "수정됨" : "원본"} /{" "}
              노이즈 제외: {excludedChunkIds.has(selectedChunk.meta.chunkId) ? "예" : "아니오"} /{" "}
              merge 대상: {mergePairs[selectedChunk.meta.chunkId] ?? "-"}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function resolveUiStatus(
  chunk: ChunkDTO,
  analyzed: ChunkQualityStatus,
  modified: Set<string>
) {
  if (modified.has(chunk.meta.chunkId)) return "수정됨";
  if (analyzed === "NOISE_SUSPECTED") return "노이즈 의심";
  if (analyzed === "TOO_LONG") return "긴 청크";
  if (analyzed === "TOO_SHORT") return "짧은 청크";
  if (analyzed === "REVIEW_REQUIRED") return "검토 필요";
  return "정상";
}

function findMergeTarget(current: ChunkDTO, chunks: ChunkDTO[]): ChunkDTO | null {
  const index = chunks.findIndex((chunk) => chunk.meta.chunkId === current.meta.chunkId);
  if (index < 0) return null;
  const next = chunks[index + 1] ?? null;
  const prev = chunks[index - 1] ?? null;
  if (next && isSameSection(current, next)) return next;
  if (prev && isSameSection(current, prev)) return prev;
  return next ?? prev ?? null;
}

function isSameSection(a: ChunkDTO, b: ChunkDTO): boolean {
  return a.meta.sectionPath.join(" > ") === b.meta.sectionPath.join(" > ");
}

function buildMergedPreview(a: ChunkDTO, b: ChunkDTO): string {
  const merged = `${a.text}\n${b.text}`.replace(/\s+/g, " ").trim();
  return `${merged.slice(0, 320)}${merged.length > 320 ? "..." : ""}`;
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "정상"
      ? { color: "#166534", bg: "#dcfce7", border: "#86efac" }
      : status === "검토 필요"
        ? { color: "#92400e", bg: "#fef3c7", border: "#fcd34d" }
        : status === "수정됨"
          ? { color: "#1d4ed8", bg: "#dbeafe", border: "#93c5fd" }
          : { color: "#b91c1c", bg: "#fee2e2", border: "#fca5a5" };
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: tone.color,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        borderRadius: 999,
        padding: "2px 7px",
      }}
    >
      {status}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 8, fontSize: 12 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ color: "#1f2937" }}>{value}</span>
    </div>
  );
}

const actionBtn = {
  border: "1px solid #d7deea",
  borderRadius: 7,
  background: "#fff",
  padding: "5px 8px",
  fontSize: 11,
  cursor: "pointer",
} as const;

