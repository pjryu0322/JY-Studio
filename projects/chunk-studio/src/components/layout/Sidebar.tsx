"use client";

import { useEffect, useMemo, useState } from "react";
import { useJobStore } from "@/store/jobStore";
import type { JobDetailDTO } from "@/types/job";

export default function Sidebar() {
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

  const sections = useMemo(() => {
    if (!selectedJob || !detail?.chunks?.length) return [];
    const map = new Map<string, number>();
    detail.chunks.forEach((chunk) => {
      const key = chunk.meta.sectionPath?.join(" > ").trim() || "Unsectioned";
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [detail, selectedJob]);

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

  const goPage = (page: number) => {
    setSelectedPage(page);
    window.dispatchEvent(new CustomEvent("chunkstudio:go-page", { detail: page }));
  };

  const selectSection = (sectionName: string) => {
    setSelectedSection(sectionName);
    window.dispatchEvent(
      new CustomEvent("chunkstudio:selected-section", { detail: sectionName })
    );
  };

  useEffect(() => {
    const onSelectedPage = (e: Event) => {
      const custom = e as CustomEvent<number>;
      if (typeof custom.detail === "number") setSelectedPage(custom.detail);
    };
    window.addEventListener("chunkstudio:selected-page", onSelectedPage as EventListener);
    return () =>
      window.removeEventListener("chunkstudio:selected-page", onSelectedPage as EventListener);
  }, []);

  return (
    <aside className="sidebar">
      <section style={{ marginBottom: 16 }}>
        <span className="sidebar__label">Document Structure</span>
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          {sections.length === 0 && (
            <div style={{ fontSize: 12, color: "#777" }}>구조 데이터 없음</div>
          )}
          {sections.slice(0, 80).map((section) => (
            <button
              key={section.name}
              type="button"
              onClick={() => selectSection(section.name)}
              style={{
                border:
                  selectedSection === section.name
                    ? "1px solid #3b82f6"
                    : "1px solid #ececec",
                borderRadius: 6,
                padding: "6px 8px",
                fontSize: 12,
                background: selectedSection === section.name ? "#eff6ff" : "#fff",
                textAlign: "left",
                cursor: "pointer",
              }}
              title={section.name}
            >
              <div
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "#333",
                }}
              >
                {section.name}
              </div>
              <div style={{ marginTop: 2, fontSize: 11, color: "#666" }}>
                chunks: {section.count}
              </div>
            </button>
          ))}
        </div>
      </section>
      <section>
        <span className="sidebar__label">Page List</span>
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {pages.length === 0 && (
            <div style={{ fontSize: 12, color: "#777" }}>
              페이지 인덱스를 계산할 수 없습니다.
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
      <section style={{ marginTop: 16 }}>
        <span className="sidebar__label">Selected Job</span>
        <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
          {selectedJob ? (
            <>
              <div
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={selectedJob.originalFilename}
              >
                {selectedJob.originalFilename ?? selectedJob.id}
              </div>
              <div style={{ marginTop: 2 }}>status: {selectedJob.status}</div>
            </>
          ) : (
            <div>선택된 작업 없음</div>
          )}
        </div>
      </section>
      <section style={{ marginTop: 16 }}>
        <span className="sidebar__label">RAG Preparation</span>
        <div style={{ marginTop: 8, fontSize: 12, color: "#666", lineHeight: 1.45 }}>
          구조/페이지 기반 provenance와 chunk metadata를 검토한 뒤 JSONL로 export합니다.
        </div>
      </section>
    </aside>
  );
}
