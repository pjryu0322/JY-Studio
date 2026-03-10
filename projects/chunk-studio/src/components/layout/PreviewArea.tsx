"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useJobStore } from "@/store/jobStore";
import type { JobDetailDTO } from "@/types/job";

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
