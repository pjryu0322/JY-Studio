"use client";

import type { Job, JobDetailDTO } from "@/types/job";
import ChunkReviewContent from "@/components/workspace/chunk-review/ChunkReviewContent";

interface JobDetailProps {
  selectedJob: Job | null;
  detail: JobDetailDTO | null;
  loading: boolean;
  error: string | null;
}

export default function JobDetail({ selectedJob, detail, loading, error }: JobDetailProps) {
  return (
    <ChunkReviewContent
      selectedJob={selectedJob}
      detail={detail}
      loading={loading}
      error={error}
    />
  );
}

