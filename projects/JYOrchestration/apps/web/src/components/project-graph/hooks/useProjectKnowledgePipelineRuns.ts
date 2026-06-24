"use client";

import { useCallback, useState } from "react";
import { fetchKnowledgePipelineRuns } from "@/lib/project-knowledge/projectKnowledgePipelineClient";
import type { KnowledgePipelineRunRecord } from "@/lib/project-knowledge/projectKnowledgePipelineMonitor";

export function useProjectKnowledgePipelineRuns(projectId: string) {
  const [pipelineRuns, setPipelineRuns] = useState<readonly KnowledgePipelineRunRecord[]>([]);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  const reloadPipelineMonitor = useCallback(async () => {
    const pid = projectId.trim();
    if (!pid) return;
    setPipelineError(null);
    setPipelineLoading(true);
    try {
      const data = await fetchKnowledgePipelineRuns(pid, 20);
      setPipelineRuns(data.recentRuns);
    } catch (e) {
      setPipelineError(e instanceof Error ? e.message : "파이프라인 기록을 불러오지 못했습니다.");
    } finally {
      setPipelineLoading(false);
    }
  }, [projectId]);

  return { pipelineRuns, pipelineLoading, pipelineError, reloadPipelineMonitor };
}
