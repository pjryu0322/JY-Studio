"use client";

import type { Job, JobDetailDTO } from "@/types/job";
import ChunkReviewContent from "./chunk-review/ChunkReviewContent";

interface ChunkReviewPanelProps {
  selectedJob: Job | null;
  detail: JobDetailDTO | null;
  loading: boolean;
  error: string | null;
  showLabels: boolean;
}

export default function ChunkReviewPanel({
  selectedJob,
  detail,
  loading,
  error,
  showLabels,
}: ChunkReviewPanelProps) {
  return (
    <section className="chunk-review-panel">
      <div className="chunk-review-panel__header">
        {showLabels && <span className="workspace-ui-label">Right Panel</span>}
        <strong>Chunk Review</strong>
      </div>
      <div className="chunk-review-panel__body">
        <ChunkReviewContent
          selectedJob={selectedJob}
          detail={detail}
          loading={loading}
          error={error}
        />
      </div>
    </section>
  );
}
