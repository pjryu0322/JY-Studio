"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChunkDTO, Job, JobDetailDTO } from "@/types/job";
import ChunkOverlayLayer from "./ChunkOverlayLayer";

const PdfPreviewClient = dynamic(
  () => import("@/components/templates/PdfPreviewClient"),
  { ssr: false }
);

const DEFAULT_ZOOM = 1;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 1.8;
const ZOOM_STEP = 0.1;

interface PdfFirstPageSize {
  width: number;
  height: number;
}

interface PdfChunkViewerProps {
  selectedJob: Job | null;
  detail: JobDetailDTO | null;
  loading: boolean;
  error: string | null;
  showLabels: boolean;
}

export default function PdfChunkViewer({
  selectedJob,
  detail,
  loading,
  error,
  showLabels,
}: PdfChunkViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [renderWidth, setRenderWidth] = useState(320);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [firstPageSize, setFirstPageSize] = useState<PdfFirstPageSize | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [failedPdfJobId, setFailedPdfJobId] = useState<string | null>(null);
  const [previewFailureReason, setPreviewFailureReason] = useState<string | null>(null);
  const [pdfAvailabilityChecked, setPdfAvailabilityChecked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const canPreviewPdf = useMemo(() => {
    const name = selectedJob?.originalFilename?.toLowerCase() ?? "";
    return name.endsWith(".pdf");
  }, [selectedJob]);
  const selectedJobId = selectedJob?.id ?? null;
  const pdfUnavailable = Boolean(selectedJob?.id && failedPdfJobId === selectedJob.id);
  const sectionCount = useMemo(() => {
    if (!detail?.chunks?.length) return 0;
    const sections = new Set<string>();
    detail.chunks.forEach((chunk) => {
      const key = chunk.meta.sectionPath?.join(" > ").trim();
      if (key) sections.add(key);
    });
    return sections.size;
  }, [detail?.chunks]);

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
      setRenderWidth(Math.max(120, Math.floor(containerWidth)));
      return;
    }
    const widthScale = containerWidth / firstPageSize.width;
    const heightScale = containerHeight / firstPageSize.height;
    const baseScale = Math.min(widthScale, heightScale);
    const zoomedScale = baseScale * zoom;
    const appliedScale = Math.min(zoomedScale, widthScale);
    setRenderWidth(Math.max(120, Math.floor(firstPageSize.width * appliedScale)));
  }, [firstPageSize, viewportSize, zoom]);

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
    const onSelectedChunk = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (typeof custom.detail === "string") setSelectedChunkId(custom.detail);
    };
    window.addEventListener("chunkstudio:selected-chunk", onSelectedChunk as EventListener);
    return () =>
      window.removeEventListener("chunkstudio:selected-chunk", onSelectedChunk as EventListener);
  }, []);

  useEffect(() => {
    const onGoPage = (e: Event) => {
      const custom = e as CustomEvent<number>;
      const page = custom.detail;
      if (!page || !scrollRef.current) return;
      const target = scrollRef.current.querySelector(
        `[data-page-number="${page}"]`
      ) as HTMLElement | null;
      if (!target) return;
      setCurrentPage(page);
      scrollRef.current.scrollTo({ top: Math.max(0, target.offsetTop - 8), behavior: "smooth" });
    };
    window.addEventListener("chunkstudio:go-page", onGoPage as EventListener);
    return () => window.removeEventListener("chunkstudio:go-page", onGoPage as EventListener);
  }, []);

  const onSelectChunk = (chunk: ChunkDTO) => {
    setSelectedChunkId(chunk.meta.chunkId);
    window.dispatchEvent(new CustomEvent("chunkstudio:selected-chunk", { detail: chunk.meta.chunkId }));
    const pageRange = (chunk.meta as unknown as { pageRange?: [number, number] }).pageRange;
    if (Array.isArray(pageRange) && pageRange[0]) {
      setCurrentPage(pageRange[0]);
      window.dispatchEvent(new CustomEvent("chunkstudio:go-page", { detail: pageRange[0] }));
      window.dispatchEvent(new CustomEvent("chunkstudio:selected-page", { detail: pageRange[0] }));
    }
  };

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
        {showLabels && <span className="workspace-ui-label">PDF Viewer</span>}
        <strong>PDF Preview</strong>
        <span style={{ color: "#666" }}>pages: {numPages || "-"} / sections: {sectionCount}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            onClick={() => setZoom((prev) => Math.max(MIN_ZOOM, Number((prev - ZOOM_STEP).toFixed(2))))}
            style={zoomBtn}
          >
            -
          </button>
          <button type="button" onClick={() => setZoom(DEFAULT_ZOOM)} style={zoomBtn}>
            {(zoom * 100).toFixed(0)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom((prev) => Math.min(MAX_ZOOM, Number((prev + ZOOM_STEP).toFixed(2))))}
            style={zoomBtn}
          >
            +
          </button>
          <span style={{ marginLeft: 6, fontSize: 11, color: "#64748b" }}>현재 페이지: {currentPage}</span>
        </div>
        {(loading || selectedJob.status === "QUEUED") && (
          <span style={{ color: "#64748b", fontSize: 11 }}>문서를 분석 중입니다.</span>
        )}
        {error && <span style={{ color: "#b91c1c", fontSize: 11 }}>{error}</span>}
      </div>

      <div className="preview-panel__scroll" ref={scrollRef} style={{ position: "relative" }}>
        {canPreviewPdf && !pdfUnavailable && pdfAvailabilityChecked ? (
          <>
            <PdfPreviewClient
              key={selectedJob.id}
              fileUrl={`/api/jobs/${selectedJob.id}/pdf`}
              width={renderWidth}
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
            <ChunkOverlayLayer
              chunks={detail?.chunks ?? []}
              currentPage={currentPage}
              selectedChunkId={selectedChunkId}
              onSelectChunk={onSelectChunk}
            />
          </>
        ) : canPreviewPdf && !pdfAvailabilityChecked ? (
          <div style={{ fontSize: 12, color: "#64748b" }}>PDF 미리보기 가능 여부를 확인 중입니다.</div>
        ) : (
          <div style={errorBox}>
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

const zoomBtn = {
  border: "1px solid #d1d5db",
  borderRadius: 6,
  background: "#fff",
  fontSize: 11,
  padding: "2px 8px",
  cursor: "pointer",
} as const;

const errorBox = {
  border: "1px solid #e0e0e0",
  borderRadius: 8,
  background: "#fff",
  padding: 12,
  fontSize: 12,
  color: "#555",
  lineHeight: 1.6,
  maxWidth: 420,
} as const;
