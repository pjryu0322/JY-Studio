"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchKnowledgeRuntimeStatus } from "@/lib/project-knowledge/projectKnowledgeRuntimeStatusClient";
import type { KnowledgeRuntimeStatusSummary } from "@/lib/project-knowledge/projectKnowledgeRuntimeStatusTypes";

export function useProjectKnowledgeRuntimeStatus(projectId: string, clientReady: boolean) {
  const [summary, setSummary] = useState<KnowledgeRuntimeStatusSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const pid = projectId.trim();
    if (!pid) return;
    setError(null);
    setLoading(true);
    try {
      const data = await fetchKnowledgeRuntimeStatus(pid);
      setSummary(data);
    } catch (e) {
      setSummary(null);
      setError(e instanceof Error ? e.message : "구조화 상태를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!clientReady) return;
    void reload();
  }, [clientReady, reload]);

  return { summary, loading, error, reload };
}
