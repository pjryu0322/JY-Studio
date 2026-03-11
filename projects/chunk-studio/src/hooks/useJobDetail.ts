"use client";

import { useEffect, useMemo, useState } from "react";
import { useJobStore } from "@/store/jobStore";
import type { Job, JobDetailDTO } from "@/types/job";

interface UseJobDetailResult {
  selectedJob: Job | null;
  detail: JobDetailDTO | null;
  loading: boolean;
  error: string | null;
}

function pickDefaultJob(jobs: Job[]): Job | null {
  return jobs.find((job) => job.status === "DONE") ?? jobs[0] ?? null;
}

export function useJobDetail(): UseJobDetailResult {
  const jobs = useJobStore((s) => s.jobs);
  const selectedJobId = useJobStore((s) => s.selectedJobId);
  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? pickDefaultJob(jobs),
    [jobs, selectedJobId]
  );
  const selectedDetailJobId = selectedJob?.id ?? null;

  const [detail, setDetail] = useState<JobDetailDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedDetailJobId) {
      setDetail(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let isInitialFetch = true;
    const load = async () => {
      try {
        if (!cancelled && isInitialFetch) setLoading(true);
        const res = await fetch(`/api/jobs/${selectedDetailJobId}`);
        if (!res.ok) {
          if (!cancelled) {
            setDetail(null);
            setError("작업 처리 중 오류가 발생했습니다.");
          }
          return;
        }
        const payload = (await res.json()) as JobDetailDTO;
        if (!cancelled) {
          setDetail(payload);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setDetail(null);
          setError("작업 처리 중 오류가 발생했습니다.");
        }
      } finally {
        if (!cancelled && isInitialFetch) {
          setLoading(false);
          isInitialFetch = false;
        }
      }
    };

    void load();
    const id = window.setInterval(() => {
      void load();
    }, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [selectedDetailJobId]);

  return { selectedJob, detail, loading, error };
}
