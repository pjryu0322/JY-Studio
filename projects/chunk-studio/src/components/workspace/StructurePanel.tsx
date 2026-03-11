"use client";

import { useEffect, useMemo, useState } from "react";
import type { Job, JobDetailDTO } from "@/types/job";
import {
  detectSectionNumberPattern,
  extractDocumentStructure,
} from "@/lib/analysis/documentStructureExtractor";

interface StructurePanelProps {
  selectedJob: Job | null;
  detail: JobDetailDTO | null;
  showLabels: boolean;
}

function getChunkStateMessage(status: string | undefined): string {
  if (status === "QUEUED") return "문서를 분석 대기 중입니다.";
  if (["CONVERTING", "PDF_READY", "EXTRACTING_TEXT", "CHUNKING"].includes(status ?? "")) {
    return "문서를 분석 중입니다.";
  }
  if (status === "FAILED") return "작업 처리 중 오류가 발생했습니다.";
  return "청크가 아직 생성되지 않았습니다.";
}

export default function StructurePanel({ selectedJob, detail, showLabels }: StructurePanelProps) {
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [previewInfo, setPreviewInfo] = useState<{ jobId: string; count: number } | null>(null);

  const sections = useMemo(() => extractDocumentStructure(detail?.chunks ?? []), [detail]);

  const pages = useMemo(() => {
    if (!selectedJob) return [];
    const previewPageCount =
      previewInfo && previewInfo.jobId === selectedJob.id ? previewInfo.count : 0;
    const set = new Set<number>();
    (detail?.chunks ?? []).forEach((chunk) => {
      const meta = chunk.meta as unknown as { pageRange?: [number, number] };
      if (Array.isArray(meta.pageRange) && meta.pageRange.length === 2) {
        for (let p = meta.pageRange[0]; p <= meta.pageRange[1]; p += 1) {
          if (p > 0 && p < 10000) {
            set.add(p);
          }
        }
      }
    });
    if (set.size === 0 && previewPageCount > 0) {
      for (let page = 1; page <= previewPageCount; page += 1) {
        set.add(page);
      }
    }
    return Array.from(set.values()).sort((a, b) => a - b);
  }, [detail, previewInfo, selectedJob]);
  const displaySections = useMemo(() => {
    const meaningfulSections = sections.filter(
      (section) => section.path !== "Unsectioned" || section.title !== "Unsectioned"
    );
    if (meaningfulSections.length > 0) {
      return meaningfulSections.slice(0, 100).map((section) => ({
        key: section.path,
        path: section.path,
        title: section.title,
        level: section.level,
        pageStart: section.pageStart,
        pageEnd: section.pageEnd,
        isVirtual: false,
      }));
    }
    if (pages.length === 0) return [];
    const chunkSize = 10;
    const virtual = [];
    for (let i = 0; i < pages.length; i += chunkSize) {
      const start = pages[i];
      const end = pages[Math.min(i + chunkSize - 1, pages.length - 1)];
      virtual.push({
        key: `virtual-${start}-${end}`,
        path: null,
        title: `페이지 ${start}~${end}`,
        level: 1,
        pageStart: start,
        pageEnd: end,
        isVirtual: true,
      });
    }
    return virtual;
  }, [pages, sections]);

  useEffect(() => {
    const onSelectedPage = (e: Event) => {
      const custom = e as CustomEvent<number>;
      if (typeof custom.detail === "number") setSelectedPage(custom.detail);
    };
    window.addEventListener("chunkstudio:selected-page", onSelectedPage as EventListener);
    return () =>
      window.removeEventListener("chunkstudio:selected-page", onSelectedPage as EventListener);
  }, []);

  useEffect(() => {
    const onPdfPageCount = (e: Event) => {
      const custom = e as CustomEvent<{ jobId?: string; count?: number }>;
      if (!selectedJob || custom.detail?.jobId !== selectedJob.id) return;
      const count = custom.detail?.count;
      if (typeof count === "number" && count > 0) {
        setPreviewInfo({ jobId: selectedJob.id, count });
      }
    };
    window.addEventListener("chunkstudio:pdf-page-count", onPdfPageCount as EventListener);
    return () =>
      window.removeEventListener("chunkstudio:pdf-page-count", onPdfPageCount as EventListener);
  }, [selectedJob]);

  const goPage = (page: number) => {
    setSelectedPage(page);
    window.dispatchEvent(new CustomEvent("chunkstudio:go-page", { detail: page }));
  };

  const selectSection = (sectionPath: string | null, pageStart: number | null) => {
    setSelectedSection(sectionPath);
    window.dispatchEvent(
      new CustomEvent("chunkstudio:selected-section", { detail: sectionPath ?? "" })
    );
    if (pageStart) {
      setSelectedPage(pageStart);
      window.dispatchEvent(new CustomEvent("chunkstudio:go-page", { detail: pageStart }));
    }
  };

  return (
    <aside className="structure-panel">
      {showLabels && <span className="workspace-ui-label">Center Panel</span>}
      <section style={{ marginBottom: 16 }}>
        <span className="structure-panel__label">구조</span>
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          {displaySections.length === 0 && (
            <div style={{ fontSize: 12, color: "#777" }}>
              {!selectedJob
                ? "PDF를 업로드해 주세요."
                : detail?.chunks?.length
                  ? "구조 정보를 아직 추출하지 못했습니다."
                  : getChunkStateMessage(selectedJob.status)}
            </div>
          )}
          {displaySections.map((section) => (
            <button
              key={section.key}
              type="button"
              onClick={() => selectSection(section.path, section.pageStart)}
              style={{
                border:
                  selectedSection === section.path
                    ? "1px solid #3b82f6"
                    : "1px solid #ececec",
                borderRadius: 6,
                padding: "6px 8px",
                fontSize: 12,
                background: selectedSection === section.path ? "#eff6ff" : "#fff",
                textAlign: "left",
                cursor: "pointer",
                marginLeft: Math.max(0, (section.level - 1) * 8),
              }}
              title={section.path ?? section.title}
            >
              <div
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "#333",
                }}
              >
                {section.isVirtual
                  ? section.title
                  : detectSectionNumberPattern(section.title)
                    ? `${section.title}`
                    : section.title}
              </div>
              <div style={{ marginTop: 2, fontSize: 11, color: "#666" }}>
                p.{section.pageStart ?? "-"} ~ p.{section.pageEnd ?? "-"}
              </div>
            </button>
          ))}
        </div>
      </section>

      {displaySections.length === 0 && (
        <section>
          <span className="structure-panel__label">페이지</span>
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {pages.length === 0 && (
              <div style={{ fontSize: 12, color: "#777" }}>
                {!selectedJob
                  ? "PDF를 업로드해 주세요."
                  : detail?.chunks?.length
                    ? "페이지 정보를 아직 추출하지 못했습니다."
                    : getChunkStateMessage(selectedJob.status)}
              </div>
            )}
            {pages.map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => goPage(page)}
                style={{
                  fontSize: 11,
                  padding: "4px 6px",
                  borderRadius: 6,
                  border: selectedPage === page ? "1px solid #3b82f6" : "1px solid #ddd",
                  background: selectedPage === page ? "#eaf2ff" : "#fff",
                  color: selectedPage === page ? "#1d4ed8" : "#334155",
                  cursor: "pointer",
                }}
              >
                p.{page}
              </button>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
