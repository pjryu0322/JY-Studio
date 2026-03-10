"use client";

import { useEffect, useMemo, useState } from "react";
import type { Job } from "@/types/job";

interface JobsResponse {
  jobs?: Job[];
}

export function useRecentJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/jobs");
        if (!res.ok) return;
        const payload = (await res.json()) as JobsResponse;
        if (!cancelled) setJobs(payload.jobs ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const documents = useMemo(() => {
    const map = new Map<string, { name: string; count: number; updatedAt: string }>();
    jobs.forEach((job) => {
      const name = job.originalFilename?.trim();
      if (!name) return;
      const prev = map.get(name);
      if (prev) {
        prev.count += 1;
        if (new Date(job.updatedAt) > new Date(prev.updatedAt)) {
          prev.updatedAt = job.updatedAt;
        }
      } else {
        map.set(name, { name, count: 1, updatedAt: job.updatedAt });
      }
    });
    return Array.from(map.values()).sort(
      (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)
    );
  }, [jobs]);

  const alerts = useMemo(() => {
    const failed = jobs.filter((job) => job.status === "FAILED").length;
    const actionRequired = jobs.filter((job) => job.status === "ACTION_REQUIRED").length;
    const running = jobs.filter((job) =>
      ["QUEUED", "CONVERTING", "EXTRACTING_TEXT", "CHUNKING"].includes(job.status)
    ).length;
    return { failed, actionRequired, running };
  }, [jobs]);

  return { jobs, documents, alerts, loading };
}
