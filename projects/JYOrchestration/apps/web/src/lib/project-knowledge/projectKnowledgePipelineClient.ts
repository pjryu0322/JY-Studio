import type { KnowledgePipelineRunRecord } from "@/lib/project-knowledge/projectKnowledgePipelineMonitor";

export type KnowledgePipelineRunsResponse = Readonly<{
  latestRun: KnowledgePipelineRunRecord | null;
  recentRuns: readonly KnowledgePipelineRunRecord[];
}>;

export async function fetchKnowledgePipelineRuns(
  projectId: string,
  limit = 20,
): Promise<KnowledgePipelineRunsResponse> {
  const pid = projectId.trim();
  if (!pid) {
    return { latestRun: null, recentRuns: [] };
  }
  const qs = limit !== 20 ? `?limit=${encodeURIComponent(String(limit))}` : "?limit=20";
  const res = await fetch(`/api/projects/${encodeURIComponent(pid)}/knowledge-pipeline${qs}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    return { latestRun: null, recentRuns: [] };
  }
  const json = (await res.json()) as {
    success?: boolean;
    data?: {
      latestRun?: KnowledgePipelineRunRecord | null;
      recentRuns?: readonly KnowledgePipelineRunRecord[];
      run?: KnowledgePipelineRunRecord | null;
    };
  };
  if (!json.success || !json.data) {
    return { latestRun: null, recentRuns: [] };
  }
  const latestRun = json.data.latestRun ?? json.data.run ?? null;
  const recentRuns = json.data.recentRuns ?? (latestRun ? [latestRun] : []);
  return { latestRun, recentRuns };
}

/** @deprecated use fetchKnowledgePipelineRuns */
export async function fetchLatestKnowledgePipelineRun(
  projectId: string,
): Promise<KnowledgePipelineRunRecord | null> {
  const data = await fetchKnowledgePipelineRuns(projectId, 1);
  return data.latestRun;
}
