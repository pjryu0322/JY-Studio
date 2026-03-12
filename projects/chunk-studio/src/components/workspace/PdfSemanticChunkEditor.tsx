"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChunkDTO, Job, JobDetailDTO } from "@/types/job";
import ChunkOverlayLayer from "./ChunkOverlayLayer";

const PdfPreviewClient = dynamic(
  () => import("@/components/templates/PdfPreviewClient"),
  { ssr: false }
);

type ZoomMode = "custom" | "fit-width" | "fit-page";

interface PdfFirstPageSize {
  width: number;
  height: number;
}

interface PdfSemanticChunkEditorProps {
  selectedJob: Job | null;
  detail: JobDetailDTO | null;
  loading: boolean;
  error: string | null;
  onUpload: (file: File | null) => Promise<void>;
  onReload: () => Promise<void>;
}

export default function PdfSemanticChunkEditor({
  selectedJob,
  detail,
  loading,
  error,
  onUpload,
  onReload,
}: PdfSemanticChunkEditorProps) {
  const [numPages, setNumPages] = useState(0);
  const [renderWidth, setRenderWidth] = useState(420);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [firstPageSize, setFirstPageSize] = useState<PdfFirstPageSize | null>(null);
  const [zoomMode, setZoomMode] = useState<ZoomMode>("custom");
  const [zoom, setZoom] = useState(0.5);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [hoverChunkId, setHoverChunkId] = useState<string | null>(null);
  const [failedPdfJobId, setFailedPdfJobId] = useState<string | null>(null);
  const [previewFailureReason, setPreviewFailureReason] = useState<string | null>(null);
  const [pdfAvailabilityChecked, setPdfAvailabilityChecked] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [boundaryRatiosByPage, setBoundaryRatiosByPage] = useState<Record<number, number[]>>({});
  const [editedLabels, setEditedLabels] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [excludedChunkIds, setExcludedChunkIds] = useState<Set<string>>(new Set());
  const [mergePairs, setMergePairs] = useState<Record<string, string>>({});
  const [modifiedChunkIds, setModifiedChunkIds] = useState<Set<string>>(new Set());
  const [splitCursorOffset, setSplitCursorOffset] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canPreviewPdf = useMemo(() => {
    const name = selectedJob?.originalFilename?.toLowerCase() ?? "";
    return name.endsWith(".pdf");
  }, [selectedJob]);
  const selectedJobId = selectedJob?.id ?? null;
  const pdfUnavailable = Boolean(selectedJob?.id && failedPdfJobId === selectedJob.id);
  const chunks = useMemo(() => detail?.chunks ?? [], [detail?.chunks]);
  const selectedChunk = useMemo(
    () => chunks.find((chunk) => chunk.meta.chunkId === selectedChunkId) ?? null,
    [chunks, selectedChunkId]
  );
  const hoverChunk = useMemo(
    () => chunks.find((chunk) => chunk.meta.chunkId === hoverChunkId) ?? null,
    [chunks, hoverChunkId]
  );
  const selectedChunkQuality = selectedChunk ? qualityLabel(selectedChunk) : null;
  const selectedChunkText = useMemo(() => {
    if (!selectedChunk) return "";
    return selectedChunk.text
      .split("\n")
      .filter(
        (line) =>
          !line.toLowerCase().includes("pdf extraction failed") &&
          !line.toLowerCase().includes("fallback content generated")
      )
      .join("\n")
      .trim();
  }, [selectedChunk]);

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    const update = () => {
      setViewportSize({
        width: Math.max(0, viewport.clientWidth),
        height: Math.max(0, viewport.clientHeight),
      });
    };
    const obs = new ResizeObserver(update);
    obs.observe(viewport);
    update();
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!firstPageSize) return;
    const containerWidth = Math.max(0, viewportSize.width - 24);
    const containerHeight = Math.max(0, viewportSize.height - 24);
    if (containerWidth <= 0 || containerHeight <= 0) return;
    const widthScale = containerWidth / firstPageSize.width;
    const heightScale = containerHeight / firstPageSize.height;
    const baseScale = zoomMode === "fit-width" ? widthScale : Math.min(widthScale, heightScale);
    const appliedScale = zoomMode === "custom" ? baseScale * zoom : baseScale;
    setRenderWidth(Math.max(120, Math.floor(firstPageSize.width * appliedScale)));
  }, [firstPageSize, viewportSize, zoom, zoomMode]);

  useEffect(() => {
    let cancelled = false;
    setPdfAvailabilityChecked(false);
    if (!selectedJobId || !canPreviewPdf) {
      setPdfAvailabilityChecked(true);
      return;
    }
    const check = async () => {
      try {
        const res = await fetch(`/api/jobs/${selectedJobId}/pdf`, { method: "HEAD" });
        if (cancelled) return;
        if (res.ok) {
          setFailedPdfJobId(null);
          setPreviewFailureReason(null);
        } else {
          setFailedPdfJobId(selectedJobId);
          setPreviewFailureReason(
            res.status === 404 ? "원본 PDF 파일을 찾을 수 없습니다." : "원본 PDF 렌더링에 실패했습니다."
          );
        }
      } catch {
        if (cancelled) return;
        setFailedPdfJobId(selectedJobId);
        setPreviewFailureReason("파일 형식 또는 렌더러 상태를 확인해 주세요.");
      } finally {
        if (!cancelled) setPdfAvailabilityChecked(true);
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [canPreviewPdf, selectedJobId]);

  useEffect(() => {
    if (!selectedJob) return;
    window.dispatchEvent(
      new CustomEvent("chunkstudio:refinements-changed", {
        detail: {
          jobId: selectedJob.id,
          editedLabels,
          reviewNotes,
          excludedChunkIds: Array.from(excludedChunkIds),
          mergePairs,
          modifiedChunkIds: Array.from(modifiedChunkIds),
        },
      })
    );
  }, [editedLabels, excludedChunkIds, mergePairs, modifiedChunkIds, reviewNotes, selectedJob]);

  const handleExport = async () => {
    if (!selectedJob) return;
    try {
      setExportError(null);
      const res = await fetch("/api/export/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedJob.id, format: "jsonl" }),
      });
      if (!res.ok) {
        setExportError("Export에 실패했습니다.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rag_dataset_${selectedJob.id}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Export 중 오류가 발생했습니다.");
    }
  };

  const selectChunk = (chunk: ChunkDTO) => {
    setSelectedChunkId(chunk.meta.chunkId);
    window.dispatchEvent(new CustomEvent("chunkstudio:selected-chunk", { detail: chunk.meta.chunkId }));
  };

  if (!selectedJob || !canPreviewPdf) {
    return (
      <section className="workspace-shell" style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ textAlign: "center", display: "grid", gap: 10 }}>
          <strong style={{ fontSize: 22, color: "#0f172a" }}>Drop PDF here</strong>
          <span style={{ fontSize: 13, color: "#64748b" }}>or click to upload</span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={floatingButton}
          >
            PDF 업로드
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              e.target.value = "";
              void onUpload(file);
            }}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="workspace-shell" style={{ height: "100vh", overflow: "hidden" }}>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: 12,
          position: "relative",
          background: "#f8fafc",
        }}
      >
        {canPreviewPdf && !pdfUnavailable && pdfAvailabilityChecked ? (
          <PdfPreviewClient
            key={selectedJob.id}
            fileUrl={`/api/jobs/${selectedJob.id}/pdf`}
            width={renderWidth}
            onFirstPageSize={setFirstPageSize}
            renderOverlay={(pageNumber, pageSize) => (
              <ChunkOverlayLayer
                chunks={chunks}
                pageNumber={pageNumber}
                pageSize={pageSize}
                selectedChunkId={selectedChunkId}
                boundaryRatios={boundaryRatiosByPage[pageNumber]}
                onBoundaryRatiosChange={(ratios) => {
                  setBoundaryRatiosByPage((prev) => ({ ...prev, [pageNumber]: ratios }));
                  const affectedIds = chunks
                    .filter((chunk) => {
                      const range = (chunk.meta as unknown as { pageRange?: [number, number] }).pageRange;
                      return Array.isArray(range) && pageNumber >= range[0] && pageNumber <= range[1];
                    })
                    .map((chunk) => chunk.meta.chunkId);
                  setModifiedChunkIds((prev) => {
                    const next = new Set(prev);
                    affectedIds.forEach((id) => next.add(id));
                    return next;
                  });
                }}
                onSelectChunk={selectChunk}
                onHoverChunk={setHoverChunkId}
              />
            )}
            onLoadSuccess={setNumPages}
            onLoadError={() => {
              setFailedPdfJobId(selectedJob.id);
              setPreviewFailureReason("원본 PDF 렌더링에 실패했습니다.");
            }}
          />
        ) : canPreviewPdf && !pdfAvailabilityChecked ? (
          <div style={{ fontSize: 12, color: "#64748b" }}>PDF 미리보기 가능 여부를 확인 중입니다.</div>
        ) : (
          <div style={errorOverlay}>
            <div style={{ fontWeight: 700 }}>PDF 미리보기를 불러오지 못했습니다.</div>
            <div>{previewFailureReason ?? "원본 PDF 렌더링에 실패했습니다."}</div>
            <div>파일 형식 또는 렌더러 상태를 확인해 주세요.</div>
          </div>
        )}

        <div style={{ position: "fixed", top: 12, left: 12, zIndex: 40, display: "flex", gap: 6 }}>
          <button type="button" style={floatingButton} onClick={() => { setZoomMode("custom"); setZoom((z) => Math.min(2.5, Number((z + 0.1).toFixed(2)))); }}>+</button>
          <button type="button" style={floatingButton} onClick={() => { setZoomMode("custom"); setZoom((z) => Math.max(0.2, Number((z - 0.1).toFixed(2)))); }}>-</button>
          <button type="button" style={floatingButton} onClick={() => setZoomMode("fit-width")}>Fit Width</button>
          <button type="button" style={floatingButton} onClick={() => setZoomMode("fit-page")}>Fit Page</button>
          <button type="button" style={floatingButton} onClick={() => { setZoomMode("custom"); setZoom(0.5); }}>
            50%
          </button>
        </div>

        {selectedChunk && (
          <div style={{ position: "fixed", top: 56, right: 16, zIndex: 45, display: "flex", gap: 6 }}>
            <button type="button" style={floatingButton} onClick={() => {
              const idx = chunks.findIndex((c) => c.meta.chunkId === selectedChunk.meta.chunkId);
              const next = idx >= 0 ? chunks[idx + 1] : null;
              if (!next) return;
              setMergePairs((prev) => ({ ...prev, [selectedChunk.meta.chunkId]: next.meta.chunkId }));
              setModifiedChunkIds((prev) => new Set(prev).add(selectedChunk.meta.chunkId).add(next.meta.chunkId));
            }}>Merge</button>
            <button type="button" style={floatingButton} onClick={() => {
              const offset = splitCursorOffset ?? Math.floor(selectedChunk.text.length / 2);
              setReviewNotes((prev) => ({
                ...prev,
                [selectedChunk.meta.chunkId]:
                  (prev[selectedChunk.meta.chunkId] ?? "") + `\n[split] offset ${offset}`,
              }));
              setModifiedChunkIds((prev) => new Set(prev).add(selectedChunk.meta.chunkId));
            }}>Split</button>
            <button type="button" style={floatingButton} onClick={() => {
              setExcludedChunkIds((prev) => {
                const next = new Set(prev);
                if (next.has(selectedChunk.meta.chunkId)) next.delete(selectedChunk.meta.chunkId);
                else next.add(selectedChunk.meta.chunkId);
                return next;
              });
              setModifiedChunkIds((prev) => new Set(prev).add(selectedChunk.meta.chunkId));
            }}>Exclude</button>
            <button type="button" style={floatingButton} onClick={() => setAiSuggestion(buildAiSuggestion(selectedChunk, chunks))}>
              AI Suggest
            </button>
          </div>
        )}

        {hoverChunk && !selectedChunk && (
          <div
            style={{
              position: "fixed",
              top: 56,
              left: 16,
              zIndex: 44,
              maxWidth: 280,
              background: "rgba(255,255,255,0.96)",
              border: "1px solid #dbe3f1",
              borderRadius: 10,
              padding: 8,
              boxShadow: "0 6px 18px rgba(15,23,42,0.12)",
              fontSize: 11,
              color: "#334155",
            }}
          >
            <div style={{ fontWeight: 700, color: "#0f172a" }}>{hoverChunk.meta.chunkId}</div>
            <div style={{ marginTop: 2 }}>
              {hoverChunk.text.slice(0, 90)}
              {hoverChunk.text.length > 90 ? "..." : ""}
            </div>
            <div style={{ marginTop: 4, color: "#64748b" }}>
              Tokens: {hoverChunk.meta.quality.tokens} / Quality: {qualityLabel(hoverChunk)}
            </div>
          </div>
        )}

        {selectedChunk && (
          <div
            style={{
              position: "fixed",
              right: 16,
              bottom: 16,
              width: 380,
              maxHeight: "70vh",
              overflow: "auto",
              background: "#fff",
              border: "1px solid #dbe3f1",
              borderRadius: 12,
              padding: 12,
              zIndex: 42,
              boxShadow: "0 8px 24px rgba(15,23,42,0.16)",
              display: "grid",
              gap: 8,
            }}
          >
            <strong style={{ fontSize: 13, color: "#0f172a" }}>Chunk Text</strong>
            <textarea
              readOnly
              value={selectedChunkText}
              onClick={(e) => setSplitCursorOffset((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
              onKeyUp={(e) => setSplitCursorOffset((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
              style={{ minHeight: 170, maxHeight: 280, resize: "vertical", ...textInput }}
            />
            <Row label="Page" value={formatPageRange(selectedChunk)} />
            {selectedChunk.meta.quality.warnings.length > 0 && (
              <div style={{ fontSize: 11, color: "#b91c1c" }}>
                Warnings: {selectedChunk.meta.quality.warnings.slice(0, 4).join(", ")}
              </div>
            )}
            <label style={{ fontSize: 12, color: "#334155", display: "grid", gap: 4 }}>
              레이블 수정
              <input
                value={editedLabels[selectedChunk.meta.chunkId] ?? selectedChunk.meta.sectionTitle ?? ""}
                onChange={(e) =>
                  setEditedLabels((prev) => ({ ...prev, [selectedChunk.meta.chunkId]: e.target.value }))
                }
                style={textInput}
              />
            </label>
            <label style={{ fontSize: 12, color: "#334155", display: "grid", gap: 4 }}>
              검토 메모
              <textarea
                rows={3}
                value={reviewNotes[selectedChunk.meta.chunkId] ?? ""}
                onChange={(e) =>
                  setReviewNotes((prev) => ({ ...prev, [selectedChunk.meta.chunkId]: e.target.value }))
                }
                style={{ ...textInput, resize: "vertical" }}
              />
            </label>
            <details>
              <summary style={{ cursor: "pointer", fontSize: 12, color: "#64748b" }}>Metadata</summary>
              <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
                <Row label="chunk id" value={selectedChunk.meta.chunkId} />
                <Row label="quality" value={selectedChunkQuality ?? "Unknown"} />
                <Row label="section" value={selectedChunk.meta.sectionPath.join(" > ") || "Unsectioned"} />
              </div>
            </details>
          </div>
        )}

        {aiSuggestion && (
          <div style={{ position: "fixed", right: 420, bottom: 16, zIndex: 46, ...errorOverlay }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>AI Suggest</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{aiSuggestion}</div>
            <button type="button" style={{ ...floatingButton, marginTop: 8 }} onClick={() => setAiSuggestion(null)}>
              닫기
            </button>
          </div>
        )}

        <div style={{ position: "fixed", bottom: 16, left: 16, zIndex: 50 }}>
          <button type="button" style={floatingButton} onClick={() => setSettingsOpen((v) => !v)}>
            ⚙
          </button>
          {settingsOpen && (
            <div style={{ marginTop: 8, background: "#fff", border: "1px solid #dbe3f1", borderRadius: 10, padding: 8, display: "grid", gap: 6, minWidth: 180 }}>
              <button type="button" style={menuBtn} onClick={() => fileInputRef.current?.click()}>
                Upload PDF
              </button>
              <button type="button" style={menuBtn} onClick={() => void onReload()}>
                Reload document
              </button>
              <button type="button" style={menuBtn} onClick={() => void handleExport()}>
                Export dataset
              </button>
              <Link href="/workspace/settings" style={{ ...menuLink }}>Workspace settings</Link>
              <Link href="/jobs" style={{ ...menuLink }}>Job list</Link>
              {exportError && <div style={{ fontSize: 11, color: "#b91c1c" }}>{exportError}</div>}
              {loading && <div style={{ fontSize: 11, color: "#64748b" }}>문서를 분석 중입니다.</div>}
              {error && <div style={{ fontSize: 11, color: "#b91c1c" }}>{error}</div>}
              <div style={{ fontSize: 11, color: "#64748b" }}>Pages: {numPages || "-"}</div>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            e.target.value = "";
            void onUpload(file);
          }}
        />
      </div>
    </section>
  );
}

function qualityLabel(chunk: ChunkDTO): string {
  const tokens = chunk.meta.quality?.tokens ?? Math.floor(chunk.text.length / 4);
  if (tokens < 80) return "Problematic";
  if (tokens < 150) return "Review";
  if (tokens > 900) return "Split suggested";
  return "Good";
}

function buildAiSuggestion(chunk: ChunkDTO, chunks: ChunkDTO[]): string {
  const tokens = chunk.meta.quality?.tokens ?? Math.floor(chunk.text.length / 4);
  if (tokens > 900) return "⚠ Chunk too long\nSuggested split at sentence 4";
  if (tokens < 80) {
    const index = chunks.findIndex((item) => item.meta.chunkId === chunk.meta.chunkId);
    const neighbor = chunks[index + 1] ?? chunks[index - 1];
    return `⚠ Chunk too short\nSuggested merge with ${neighbor?.meta.chunkId ?? "adjacent chunk"}`;
  }
  return "✅ Chunk quality is acceptable.\nSuggested action: keep current boundary.";
}

function formatPageRange(chunk: ChunkDTO): string {
  const range = (chunk.meta as unknown as { pageRange?: [number, number] }).pageRange;
  if (!Array.isArray(range)) return "p.- ~ p.-";
  return `p.${range[0]} ~ p.${range[1]}`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 8, fontSize: 12 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ color: "#1f2937" }}>{value}</span>
    </div>
  );
}

const textInput = {
  width: "100%",
  border: "1px solid #d7deea",
  borderRadius: 8,
  padding: "6px 8px",
  fontSize: 12,
} as const;

const floatingButton = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff",
  fontSize: 12,
  padding: "6px 10px",
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(15,23,42,0.08)",
} as const;

const errorOverlay = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 12,
  fontSize: 12,
  color: "#475569",
  lineHeight: 1.6,
  maxWidth: 360,
  boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
} as const;

const menuBtn = {
  border: "1px solid #d7deea",
  borderRadius: 7,
  background: "#fff",
  padding: "6px 8px",
  fontSize: 12,
  cursor: "pointer",
  textAlign: "left",
} as const;

const menuLink = {
  border: "1px solid #d7deea",
  borderRadius: 7,
  background: "#fff",
  padding: "6px 8px",
  fontSize: 12,
  textDecoration: "none",
  color: "#334155",
} as const;
