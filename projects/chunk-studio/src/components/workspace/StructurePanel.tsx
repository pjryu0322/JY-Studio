"use client";

import { useEffect, useMemo, useState } from "react";
import { useJobStore } from "@/store/jobStore";
import type { JobDetailDTO } from "@/types/job";
import {
  detectSectionNumberPattern,
  extractDocumentStructure,
} from "@/lib/analysis/documentStructureExtractor";

export default function StructurePanel() {
  const jobs = useJobStore((s) => s.jobs);
  const selectedJobId = useJobStore((s) => s.selectedJobId);
  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null,
    [jobs, selectedJobId]
  );
  const [detail, setDetail] = useState<JobDetailDTO | null>(null);
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

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

  const sections = useMemo(() => extractDocumentStructure(detail?.chunks ?? []), [detail]);

  const pages = useMemo(() => {
    if (!selectedJob || !detail?.chunks?.length) return [];
    const set = new Set<number>();
    detail.chunks.forEach((chunk) => {
      const maybe = chunk.meta as unknown as { pageRange?: [number, number] };
      if (Array.isArray(maybe.pageRange) && maybe.pageRange.length === 2) {
        for (let p = maybe.pageRange[0]; p <= maybe.pageRange[1]; p += 1) {
          if (p > 0 && p < 10000) set.add(p);
        }
      }
    });
    return Array.from(set.values()).sort((a, b) => a - b);
  }, [detail, selectedJob]);

  useEffect(() => {
    const onSelectedPage = (e: Event) => {
      const custom = e as CustomEvent<number>;
      if (typeof custom.detail === "number") setSelectedPage(custom.detail);
    };
    window.addEventListener("chunkstudio:selected-page", onSelectedPage as EventListener);
    return () =>
      window.removeEventListener("chunkstudio:selected-page", onSelectedPage as EventListener);
  }, []);

  const goPage = (page: number) => {
    setSelectedPage(page);
    window.dispatchEvent(new CustomEvent("chunkstudio:go-page", { detail: page }));
  };

  const selectSection = (sectionPath: string, pageStart: number | null) => {
    setSelectedSection(sectionPath);
    window.dispatchEvent(
      new CustomEvent("chunkstudio:selected-section", { detail: sectionPath })
    );
    if (pageStart) {
      setSelectedPage(pageStart);
      window.dispatchEvent(new CustomEvent("chunkstudio:go-page", { detail: pageStart }));
    }
  };

  return (
    <aside className="structure-panel">
      <section style={{ marginBottom: 16 }}>
        <span className="structure-panel__label">Document Structure</span>
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          {sections.length === 0 && (
            <div style={{ fontSize: 12, color: "#777" }}>구조 정보를 찾을 수 없습니다.</div>
          )}
          {sections.slice(0, 100).map((section) => (
            <button
              key={section.sectionId}
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
              title={section.path}
            >
              <div
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "#333",
                }}
              >
                {detectSectionNumberPattern(section.title)
                  ? `${section.title}`
                  : section.title}
              </div>
              <div style={{ marginTop: 2, fontSize: 11, color: "#666" }}>
                p.{section.pageStart ?? "-"} ~ p.{section.pageEnd ?? "-"} / L{section.level}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <span className="structure-panel__label">Page List</span>
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {pages.length === 0 && (
            <div style={{ fontSize: 12, color: "#777" }}>페이지 정보가 없습니다.</div>
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
    </aside>
  );
}
