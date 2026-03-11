"use client";

import { useEffect, useMemo, useState } from "react";
import JobDetail from "@/components/jobs/JobDetail";
import { useJobStore } from "@/store/jobStore";
import type { RagRefinementPayload } from "@/lib/analysis/ragExportOptimizer";

type RefinementEventPayload = RagRefinementPayload & { jobId: string };

export default function ChunkReviewPanel() {
  const jobs = useJobStore((s) => s.jobs);
  const selectedJobId = useJobStore((s) => s.selectedJobId);
  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null,
    [jobs, selectedJobId]
  );

  const [exportFormat, setExportFormat] = useState<"json" | "jsonl" | "csv">("jsonl");
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [refinements, setRefinements] = useState<RagRefinementPayload | null>(null);

  useEffect(() => {
    setRefinements(null);
  }, [selectedJob?.id]);

  useEffect(() => {
    const onRefinementsChanged = (e: Event) => {
      const custom = e as CustomEvent<RefinementEventPayload>;
      if (!selectedJob || custom.detail?.jobId !== selectedJob.id) return;
      setRefinements({
        editedLabels: custom.detail.editedLabels ?? {},
        reviewNotes: custom.detail.reviewNotes ?? {},
        excludedChunkIds: custom.detail.excludedChunkIds ?? [],
        mergePairs: custom.detail.mergePairs ?? {},
        modifiedChunkIds: custom.detail.modifiedChunkIds ?? [],
      });
    };
    window.addEventListener(
      "chunkstudio:refinements-changed",
      onRefinementsChanged as EventListener
    );
    return () =>
      window.removeEventListener(
        "chunkstudio:refinements-changed",
        onRefinementsChanged as EventListener
      );
  }, [selectedJob]);

  const exportRagDataset = async () => {
    if (!selectedJob || isExporting) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/export/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: selectedJob.id,
          format: exportFormat,
          refinements: refinements ?? undefined,
        }),
      });
      if (!res.ok) {
        setExportError("RAG export 실패");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeJobId = selectedJob.id.replace(/[^\w.-]+/g, "_");
      a.download = `rag_dataset_${safeJobId}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("RAG export 중 오류가 발생했습니다.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="chunk-review-panel">
      <div className="chunk-review-panel__header">
        <strong>Chunk Review</strong>
      </div>
      <div className="chunk-review-panel__body">
        <JobDetail key={selectedJob?.id ?? "no-job"} />
        <section
          style={{
            margin: "10px 16px 14px",
            border: "1px solid #dfe5f0",
            borderRadius: 10,
            background: "#fff",
            padding: 10,
          }}
        >
          <strong style={{ fontSize: 12, color: "#0f172a" }}>RAG 데이터셋 내보내기</strong>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <select
              aria-label="RAG export format"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as "json" | "jsonl" | "csv")}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                padding: "4px 6px",
                fontSize: 12,
                background: "#fff",
              }}
            >
              <option value="json">JSON</option>
              <option value="jsonl">JSONL</option>
              <option value="csv">CSV</option>
            </select>
            <button
              type="button"
              onClick={() => void exportRagDataset()}
              disabled={!selectedJob || isExporting}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 7,
                background: "#fff",
                color: "#334155",
                fontSize: 12,
                padding: "4px 9px",
                cursor: !selectedJob || isExporting ? "not-allowed" : "pointer",
              }}
            >
              {isExporting ? "내보내는 중..." : "RAG 데이터셋 다운로드"}
            </button>
          </div>
          {exportError && (
            <div style={{ marginTop: 6, color: "#b91c1c", fontSize: 11 }}>{exportError}</div>
          )}
        </section>
      </div>
    </section>
  );
}
