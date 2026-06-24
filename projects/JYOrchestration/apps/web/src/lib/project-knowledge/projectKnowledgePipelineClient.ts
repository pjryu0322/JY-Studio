import type { KnowledgePipelineRunRecord } from "@/lib/project-knowledge/projectKnowledgePipelineMonitor";

export async function fetchLatestKnowledgePipelineRun(
  projectId: string,
): Promise<KnowledgePipelineRunRecord | null> {
  const pid = projectId.trim();
  if (!pid) return null;
  const res = await fetch(`/api/projects/${encodeURIComponent(pid)}/knowledge-pipeline`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { success?: boolean; data?: { run?: KnowledgePipelineRunRecord | null } };
  if (!json.success) return null;
  return json.data?.run ?? null;
}
