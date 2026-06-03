"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchExecutionRuns,
  type TaskExecutionRunDto,
} from "@/components/project-spec/apis/executionLoopEnvironmentRunsApi";

export function useLatestProjectExecutionRun(projectId: string) {
  const [run, setRun] = useState<TaskExecutionRunDto | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    const pid = projectId.trim();
    if (!pid) return;
    setLoading(true);
    try {
      const { res, json } = await fetchExecutionRuns(pid, { take: 1 });
      if (!res.ok || !json.success || !json.data?.length) {
        setRun(null);
        return;
      }
      setRun(json.data[0] ?? null);
    } catch {
      setRun(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { run, loading, reload };
}
