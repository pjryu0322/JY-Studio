"use client";

import { useEffect, useState } from "react";
import JobDetail from "@/components/jobs/JobDetail";
import type { RagRefinementPayload } from "@/lib/analysis/ragExportOptimizer";
import type { Job, JobDetailDTO } from "@/types/job";
import RagExportSection from "./RagExportSection";

type RefinementEventPayload = RagRefinementPayload & { jobId: string };

interface ChunkReviewPanelProps {
  selectedJob: Job | null;
  detail: JobDetailDTO | null;
  loading: boolean;
  error: string | null;
}

export default function ChunkReviewPanel({
  selectedJob,
  detail,
  loading,
  error,
}: ChunkReviewPanelProps) {

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
        <JobDetail
          key={selectedJob?.id ?? "no-job"}
          selectedJob={selectedJob}
          detail={detail}
          loading={loading}
          error={error}
        />
        <RagExportSection
          exportFormat={exportFormat}
          isExporting={isExporting}
          exportError={exportError}
          onChangeFormat={setExportFormat}
          onExport={() => void exportRagDataset()}
          disabled={!selectedJob || isExporting}
        />
      </div>
    </section>
  );
}
