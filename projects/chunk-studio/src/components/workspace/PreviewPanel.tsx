"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Job, JobDetailDTO } from "@/types/job";
import {
  detectBoundaryIssues,
  suggestMergeCandidates,
} from "@/lib/analysis/chunkBoundaryInspector";
import { mapPageToChunks } from "@/lib/analysis/chunkMappingService";

const PdfPreviewClient = dynamic(
  () => import("@/components/templates/PdfPreviewClient"),
  { ssr: false }
);
const DEFAULT_PREVIEW_ZOOM = 1;
const MIN_PREVIEW_ZOOM = 0.6;
const MAX_PREVIEW_ZOOM = 1.8;
const PREVIEW_ZOOM_STEP = 0.1;

function toStatusGroup(status: string | undefined): "idle" | "processing" | "done" | "failed" {
  if (!status) return "idle";
  if (status === "FAILED") return "failed";
  if (status === "DONE") return "done";
  if (["QUEUED", "CONVERTING", "PDF_READY", "EXTRACTING_TEXT", "CHUNKING"].includes(status)) {
    return "processing";
  }
  return "idle";
}

interface PreviewPanelProps {
  selectedJob: Job | null;
  detail: JobDetailDTO | null;
  loading: boolean;
  error: string | null;
  showLabels: boolean;
}

interface PdfFirstPageSize {
  width: number;
  height: number;
}

export default function PreviewPanel({
  selectedJob,
  detail,
  loading,
  error,
  showLabels,
}: PreviewPanelProps) {
  const [numPages, setNumPages] = useState(0);
  const [width, setWidth] = useState(320);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [firstPageSize, setFirstPageSize] = useState<PdfFirstPageSize | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_PREVIEW_ZOOM);
  const [failedPdfJobId, setFailedPdfJobId] = useState<string | null>(null);
  const [previewFailureReason, setPreviewFailureReason] = useState<string | null>(null);
  const [pdfAvailabilityChecked, setPdfAvailabilityChecked] = useState(false);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const canPreviewPdf = useMemo(() => {
    const name = selectedJob?.originalFilename?.toLowerCase() ?? "";
    return name.endsWith(".pdf");
  }, [selectedJob]);
  const pdfUnavailable = Boolean(
    selectedJob?.id && failedPdfJobId && selectedJob.id === failedPdfJobId
  );
  const selectedJobId = selectedJob?.id ?? null;
  const visiblePages = canPreviewPdf && !pdfUnavailable ? numPages || "-" : "-";
  const statusGroup = toStatusGroup(selectedJob?.status);
  const processingMessage = selectedJob?.status === "QUEUED"
    ? "문서를 분석 대기 중입니다."
    : "문서를 분석 중입니다.";

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
    const containerWidth = Math.max(0, viewportSize.width - 24);
    const containerHeight = Math.max(0, viewportSize.height - 24);
    if (!firstPageSize || containerWidth <= 0 || containerHeight <= 0) {
      const fallback = Math.floor(containerWidth * DEFAULT_PREVIEW_ZOOM);
      setWidth(Math.max(120, fallback));
      return;
    }
    const widthScale = containerWidth / firstPageSize.width;
    const heightScale = containerHeight / firstPageSize.height;
    const fitToPanelScale = Math.min(widthScale, heightScale);
    const zoomedScale = fitToPanelScale * zoom;
    const appliedScale = Math.min(zoomedScale, widthScale);
    const renderWidth = Math.floor(firstPageSize.width * appliedScale);
    setWidth(Math.max(120, renderWidth));
  }, [firstPageSize, viewportSize, zoom]);

  useEffect(() => {
    let cancelled = false;
    setPdfAvailabilityChecked(false);
    if (!selectedJobId || !canPreviewPdf) {
      if (!cancelled) setPdfAvailabilityChecked(true);
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
            res.status === 404
              ? "원본 PDF 파일을 찾을 수 없습니다."
              : "원본 PDF 렌더링에 실패했습니다."
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
    const onSelectedChunk = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (typeof custom.detail === "string") setSelectedChunkId(custom.detail);
    };
    window.addEventListener("chunkstudio:selected-chunk", onSelectedChunk as EventListener);
    return () =>
      window.removeEventListener("chunkstudio:selected-chunk", onSelectedChunk as EventListener);
  }, []);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !detail?.chunks?.length) return;
    const onClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const pageContainer = target?.closest("[data-page-number]") as HTMLElement | null;
      if (!pageContainer) return;
      const pageText = pageContainer.getAttribute("data-page-number");
      const page = Number(pageText);
      if (!Number.isFinite(page) || page <= 0) return;
      const mapped = mapPageToChunks(detail.chunks, page);
      if (mapped.length === 0) return;
      const chunkId = mapped[0].meta.chunkId;
      setSelectedChunkId(chunkId);
      window.dispatchEvent(new CustomEvent("chunkstudio:selected-chunk", { detail: chunkId }));
      window.dispatchEvent(new CustomEvent("chunkstudio:selected-page", { detail: page }));
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [detail]);

  useEffect(() => {
    const onGoPage = (e: Event) => {
      const custom = e as CustomEvent<number>;
      const page = custom.detail;
      if (!page || !scrollRef.current) return;
      const target = scrollRef.current.querySelector(
        `[data-page-number="${page}"]`
      ) as HTMLElement | null;
      if (!target) return;
      scrollRef.current.scrollTo({ top: Math.max(0, target.offsetTop - 8), behavior: "smooth" });
    };
    window.addEventListener("chunkstudio:go-page", onGoPage as EventListener);
    return () => window.removeEventListener("chunkstudio:go-page", onGoPage as EventListener);
  }, []);

  const sectionCount = useMemo(() => {
    if (!detail?.chunks?.length) return 0;
    const sections = new Set<string>();
    detail.chunks.forEach((chunk) => {
      const key = chunk.meta.sectionPath?.join(" > ").trim();
      if (key) sections.add(key);
    });
    return sections.size;
  }, [detail]);

  const boundaryOverview = useMemo(() => {
    const chunks = detail?.chunks ?? [];
    const issues = detectBoundaryIssues(chunks);
    const mergeCandidates = suggestMergeCandidates(chunks);
    const top = chunks.slice(0, 12).map((chunk, index) => {
      const pageRange = (chunk.meta as unknown as { pageRange?: [number, number] }).pageRange;
      const start = Array.isArray(pageRange) ? pageRange[0] : null;
      const end = Array.isArray(pageRange) ? pageRange[1] : null;
      return {
        chunkId: chunk.meta.chunkId,
        index,
        start,
        end,
        isSelected: selectedChunkId === chunk.meta.chunkId,
      };
    });
    return { top, issueCount: issues.length, mergeCount: mergeCandidates.length };
  }, [detail, selectedChunkId]);

  if (!selectedJob) {
    return (
      <section className="preview-panel">
        <div style={{ padding: 16, color: "#666", fontSize: 13 }}>PDF를 업로드해 주세요.</div>
      </section>
    );
  }

  return (
    <section className="preview-panel">
      <div className="preview-panel__header">
        {showLabels && <span className="workspace-ui-label">Left Panel</span>}
        <strong>PDF Preview</strong>
        <span style={{ color: "#666" }}>pages: {visiblePages} / sections: {sectionCount}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            onClick={() =>
              setZoom((prev) =>
                Math.max(MIN_PREVIEW_ZOOM, Number((prev - PREVIEW_ZOOM_STEP).toFixed(2)))
              )
            }
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 6,
              background: "#fff",
              fontSize: 11,
              padding: "2px 8px",
              cursor: "pointer",
            }}
          >
            -
          </button>
          <button
            type="button"
            onClick={() => setZoom(DEFAULT_PREVIEW_ZOOM)}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 6,
              background: "#fff",
              fontSize: 11,
              padding: "2px 8px",
              cursor: "pointer",
            }}
            title="패널 맞춤 배율로 초기화"
          >
            {(zoom * 100).toFixed(0)}%
          </button>
          <button
            type="button"
            onClick={() =>
              setZoom((prev) =>
                Math.min(MAX_PREVIEW_ZOOM, Number((prev + PREVIEW_ZOOM_STEP).toFixed(2)))
              )
            }
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 6,
              background: "#fff",
              fontSize: 11,
              padding: "2px 8px",
              cursor: "pointer",
            }}
          >
            +
          </button>
        </div>
        {(statusGroup === "processing" || loading) && (
          <span style={{ color: "#64748b", fontSize: 11 }}>{processingMessage}</span>
        )}
        {statusGroup === "failed" && (
          <span style={{ color: "#b91c1c", fontSize: 11 }}>문서 분석에 실패했습니다.</span>
        )}
        {error && <span style={{ color: "#b91c1c", fontSize: 11 }}>{error}</span>}
        <details style={{ marginTop: 2 }}>
          <summary style={{ cursor: "pointer", fontSize: 11, color: "#475569" }}>
            경계 점검 ({boundaryOverview.issueCount}) / 머지 후보 ({boundaryOverview.mergeCount})
          </summary>
          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {boundaryOverview.top.map((item) => (
              <button
                key={item.chunkId}
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("chunkstudio:selected-chunk", { detail: item.chunkId })
                  )
                }
                style={{
                  border: item.isSelected ? "1px solid #3b82f6" : "1px solid #cbd5e1",
                  borderRadius: 999,
                  background: item.isSelected ? "#eaf2ff" : "#f8fafc",
                  color: item.isSelected ? "#1d4ed8" : "#334155",
                  padding: "2px 7px",
                  cursor: "pointer",
                  fontSize: 11,
                }}
              >
                #{item.index + 1} p.{item.start ?? "-"}~{item.end ?? "-"}
              </button>
            ))}
          </div>
        </details>
      </div>

      <div className="preview-panel__scroll" ref={scrollRef}>
        {canPreviewPdf && !pdfUnavailable && pdfAvailabilityChecked ? (
          <PdfPreviewClient
            key={selectedJob.id}
            fileUrl={`/api/jobs/${selectedJob.id}/pdf`}
            width={width}
            onFirstPageSize={setFirstPageSize}
            onLoadSuccess={(count) => {
              setNumPages(count);
              window.dispatchEvent(
                new CustomEvent("chunkstudio:pdf-page-count", {
                  detail: { jobId: selectedJob.id, count },
                })
              );
            }}
            onLoadError={() => {
              setFailedPdfJobId(selectedJob.id);
              setPreviewFailureReason("원본 PDF 렌더링에 실패했습니다.");
            }}
          />
        ) : canPreviewPdf && !pdfAvailabilityChecked ? (
          <div style={{ fontSize: 12, color: "#64748b" }}>PDF 미리보기 가능 여부를 확인 중입니다.</div>
        ) : (
          <div
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: 8,
              background: "#fff",
              padding: 12,
              fontSize: 12,
              color: "#555",
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 600, color: "#334155", marginBottom: 4 }}>
              PDF 미리보기를 불러오지 못했습니다.
            </div>
            <div style={{ color: "#64748b", marginBottom: 4 }}>
              {previewFailureReason ?? "원본 PDF 렌더링에 실패했습니다."}
            </div>
            <div style={{ color: "#64748b" }}>파일 형식 또는 렌더러 상태를 확인해 주세요.</div>
          </div>
        )}
      </div>
    </section>
  );
}
