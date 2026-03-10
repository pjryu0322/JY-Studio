"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useJobStore } from "@/store/jobStore";
import type { JobDetailDTO } from "@/types/job";
import {
  detectBoundaryIssues,
  suggestMergeCandidates,
} from "@/lib/analysis/chunkBoundaryInspector";
import { mapPageToChunks } from "@/lib/analysis/chunkMappingService";

const PdfPreviewClient = dynamic(
  () => import("@/components/templates/PdfPreviewClient"),
  { ssr: false }
);

export default function PreviewArea() {
  const jobs = useJobStore((s) => s.jobs);
  const selectedJobId = useJobStore((s) => s.selectedJobId);
  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null,
    [jobs, selectedJobId]
  );
  const [detail, setDetail] = useState<JobDetailDTO | null>(null);
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

  useEffect(() => {
    if (!selectedJob) return;
    let cancelled = false;
    fetch(`/api/jobs/${selectedJob.id}`)
      .then(async (res) => (res.ok ? ((await res.json()) as JobDetailDTO) : null))
      .then((next) => {
        if (!cancelled) setDetail(next);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedJob]);

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
      scrollRef.current.scrollTo({
        top: Math.max(0, target.offsetTop - 8),
        behavior: "smooth",
      });
    };
    window.addEventListener("chunkstudio:go-page", onGoPage as EventListener);
    return () =>
      window.removeEventListener("chunkstudio:go-page", onGoPage as EventListener);
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
      <section className="preview-area">
        <div style={{ padding: 16, color: "#666", fontSize: 13 }}>
          문서를 업로드하면 미리보기가 표시됩니다.
        </div>
      </section>
    );
  }

  return (
    <section className="preview-area" ref={hostRef}>
      <div className="preview-area__header">
        <strong>Document Preview</strong>
        <span style={{ color: "#666" }}>
          {selectedJob.originalFilename ?? selectedJob.id}
        </span>
        <span style={{ color: "#666" }}>
          status: {selectedJob.status} / sections: {sectionCount} / pages:{" "}
          {visiblePages}
        </span>
      </div>
      <div
        style={{
          margin: "8px 8px 0",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          background: "#fff",
          padding: 8,
          fontSize: 11,
          color: "#334155",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <strong>Semantic Chunk Boundary Inspector</strong>
          <span>
            issues: {boundaryOverview.issueCount} / merge candidates:{" "}
            {boundaryOverview.mergeCount}
          </span>
        </div>
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
              }}
              title={`${item.chunkId} / start p.${item.start ?? "-"} / end p.${item.end ?? "-"}`}
            >
              #{item.index + 1} start p.{item.start ?? "-"} end p.{item.end ?? "-"}
            </button>
          ))}
        </div>
      </div>
      <div className="preview-area__scroll" ref={scrollRef}>
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
              : "이 작업은 PDF 원본이 아니라서 미리보기 대신 추출 텍스트를 표시합니다.\n\n"}
            {(detail?.extractedText || "").slice(0, 5000) || "표시할 텍스트가 없습니다."}
          </div>
        )}
      </div>
    </section>
  );
}
