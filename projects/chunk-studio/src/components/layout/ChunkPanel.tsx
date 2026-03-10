"use client";

import { useEffect, useMemo, useState } from "react";
import JobDetail from "@/components/jobs/JobDetail";
import { useJobStore } from "@/store/jobStore";
import type { JobDetailDTO } from "@/types/job";
import { analyzeChunkQualityBatch } from "@/lib/analysis/chunkQualityAnalyzer";
import {
  detectBoundaryIssues,
  suggestMergeCandidates,
} from "@/lib/analysis/chunkBoundaryInspector";
import type { RagRefinementPayload } from "@/lib/analysis/ragExportOptimizer";

type RefinementEventPayload = RagRefinementPayload & { jobId: string };

export default function ChunkPanel() {
  const jobs = useJobStore((s) => s.jobs);
  const selectedJobId = useJobStore((s) => s.selectedJobId);
  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null,
    [jobs, selectedJobId]
  );
  const [detail, setDetail] = useState<JobDetailDTO | null>(null);
  const [exportFormat, setExportFormat] = useState<"json" | "jsonl" | "csv">(
    "jsonl"
  );
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [refinements, setRefinements] = useState<RagRefinementPayload | null>(null);

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

  const analyzerSummary = useMemo(() => {
    const chunks = detail?.chunks ?? [];
    const quality = analyzeChunkQualityBatch(chunks);
    const issues = detectBoundaryIssues(chunks);
    const mergeCandidates = suggestMergeCandidates(chunks);
    return {
      normal: quality.filter((q) => q.status === "NORMAL").length,
      review: quality.filter((q) => q.status === "REVIEW_REQUIRED").length,
      noise: quality.filter((q) => q.status === "NOISE_SUSPECTED").length,
      long: quality.filter((q) => q.status === "TOO_LONG").length,
      short: quality.filter((q) => q.status === "TOO_SHORT").length,
      issues: issues.length,
      mergeCandidates: mergeCandidates.length,
    };
  }, [detail]);

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
    <section className="chunk-panel">
      <div className="chunk-panel__header">
        <strong>Chunk Review Panel</strong>
        <span style={{ color: "#666" }}>
          boundaries / quality / mapping / export
        </span>
      </div>
      <div
        style={{
          margin: "8px 8px 0",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          background: "#fff",
          padding: 8,
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          fontSize: 11,
        }}
      >
        <SummaryBadge label="정상" value={analyzerSummary.normal} color="#166534" bg="#dcfce7" />
        <SummaryBadge
          label="검토필요"
          value={analyzerSummary.review}
          color="#92400e"
          bg="#fef3c7"
        />
        <SummaryBadge
          label="노이즈의심"
          value={analyzerSummary.noise}
          color="#b91c1c"
          bg="#fee2e2"
        />
        <SummaryBadge
          label="긴 청크"
          value={analyzerSummary.long}
          color="#1d4ed8"
          bg="#dbeafe"
        />
        <SummaryBadge
          label="짧은 청크"
          value={analyzerSummary.short}
          color="#7c3aed"
          bg="#ede9fe"
        />
        <SummaryBadge
          label="경계 이슈"
          value={analyzerSummary.issues}
          color="#0f172a"
          bg="#f1f5f9"
        />
        <SummaryBadge
          label="머지 후보"
          value={analyzerSummary.mergeCandidates}
          color="#0f172a"
          bg="#f1f5f9"
        />
      </div>
      <div
        style={{
          margin: "8px 8px 0",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          background: "#fff",
          padding: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          fontSize: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong style={{ color: "#0f172a" }}>RAG Export Optimizer</strong>
          <select
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
            <option value="jsonl">JSONL</option>
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
        </div>
        <span style={{ color: "#64748b", fontSize: 11 }}>
          modified: {refinements?.modifiedChunkIds?.length ?? 0} / excluded:{" "}
          {refinements?.excludedChunkIds?.length ?? 0}
        </span>
        <button
          type="button"
          onClick={() => void exportRagDataset()}
          disabled={!selectedJob || isExporting}
          style={{
            border: "1px solid #3b82f6",
            borderRadius: 7,
            background: isExporting ? "#bfdbfe" : "#2563eb",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            padding: "5px 10px",
            cursor: !selectedJob || isExporting ? "not-allowed" : "pointer",
          }}
        >
          {isExporting ? "내보내는 중..." : "RAG 내보내기"}
        </button>
      </div>
      {exportError && (
        <div
          style={{
            margin: "6px 8px 0",
            color: "#b91c1c",
            fontSize: 11,
          }}
        >
          {exportError}
        </div>
      )}
      <div className="chunk-panel__body">
        <JobDetail key={selectedJob?.id ?? "no-job"} />
      </div>
    </section>
  );
}

function SummaryBadge({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <span
      style={{
        borderRadius: 999,
        border: "1px solid #d1d5db",
        background: bg,
        color,
        fontWeight: 700,
        padding: "3px 8px",
      }}
    >
      {label}: {value}
    </span>
  );
}
