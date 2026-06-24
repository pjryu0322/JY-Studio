"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadProjectGraphActivitySummary,
  type ProjectGraphActivitySummary,
} from "@/lib/project-graph/projectGraphActivityClient";

export function useProjectKnowledgeGraphActivity(input: {
  readonly projectId: string;
  readonly clientReady: boolean;
  readonly enabled: boolean;
  readonly syncOnEntry: boolean;
}) {
  const [activitySummary, setActivitySummary] = useState<ProjectGraphActivitySummary | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  const reloadActivity = useCallback(
    async (withSync: boolean) => {
      const pid = input.projectId.trim();
      if (!pid) return;
      setActivityError(null);
      setActivityLoading(true);
      try {
        const summary = await loadProjectGraphActivitySummary(pid, { sync: withSync });
        setActivitySummary(summary);
      } catch (e) {
        setActivityError(e instanceof Error ? e.message : "생성 현황을 불러오지 못했습니다.");
      } finally {
        setActivityLoading(false);
      }
    },
    [input.projectId],
  );

  useEffect(() => {
    if (!input.clientReady || !input.enabled) return;
    void reloadActivity(input.syncOnEntry);
  }, [input.clientReady, input.enabled, input.projectId, input.syncOnEntry, reloadActivity]);

  return { activitySummary, activityLoading, activityError, reloadActivity };
}
