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
}

export default function PreviewPanel({
  selectedJob,
  detail,
  loading,
  error,
}: PreviewPanelProps) {
  const [numPages, setNumPages] = useState(0);
  const [width, setWidth] = useState(760);
  const [failedPdfJobId, setFailedPdfJobId] = useState<string | null>(null);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const canPreviewPdf = useMemo(() => {
    const name = selectedJob?.originalFilename?.toLowerCase() ?? "";
    return name.endsWith(".pdf");
  }, [selectedJob]);
  const pdfUnavailable = Boolean(
    selectedJob?.id && failedPdfJobId && selectedJob.id === failedPdfJobId
  );
  const visiblePages = canPreviewPdf && !pdfUnavailable ? numPages || "-" : "-";
  const statusGroup = toStatusGroup(selectedJob?.status);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = () => {
      const w = host.clientWidth;
      setWidth(Math.max(420, Math.min(940, w - 32)));
    };
    const obs = new ResizeObserver(update);
    obs.observe(host);
    update();
    return () => obs.disconnect();
  }, []);

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
    <section className="preview-panel" ref={hostRef}>
      <div className="preview-panel__header">
        <strong>PDF Preview</strong>
        <span style={{ color: "#666" }}>pages: {visiblePages} / sections: {sectionCount}</span>
        {(statusGroup === "processing" || loading) && (
          <span style={{ color: "#64748b", fontSize: 11 }}>문서를 분석 중입니다.</span>
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
        {!canPreviewPdf && (
          <div style={{ marginBottom: 8, fontSize: 11, color: "#64748b" }}>
            PDF가 아닌 문서는 추출 텍스트만 표시됩니다.
          </div>
        )}
        {canPreviewPdf && !pdfUnavailable ? (
          <PdfPreviewClient
            key={selectedJob.id}
            fileUrl={`/api/jobs/${selectedJob.id}/pdf`}
            width={width}
            onLoadSuccess={setNumPages}
            onLoadError={() => setFailedPdfJobId(selectedJob.id)}
          />
        ) : (
          <div
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: 8,
              background: "#fff",
              padding: 12,
              fontSize: 12,
              color: "#555",
              whiteSpace: "pre-wrap",
              lineHeight: 1.5,
            }}
          >
            {canPreviewPdf
              ? "PDF 미리보기를 불러오지 못했습니다. 아래는 추출 텍스트입니다.\n\n"
              : ""}
            {(detail?.extractedText || "").slice(0, 5000) || "표시할 텍스트가 없습니다."}
          </div>
        )}
      </div>
    </section>
  );
}
