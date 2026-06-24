import type { ProjectKnowledgeTraceResult } from "@/lib/project-knowledge/projectKnowledgeTraceTypes";

type ApiEnvelope<T> = { success?: boolean; message?: string; data?: T };

export async function fetchKnowledgeTrace(
  projectId: string,
  nodeId: string,
): Promise<ProjectKnowledgeTraceResult> {
  const pid = projectId.trim();
  const nid = nodeId.trim();
  if (!pid || !nid) throw new Error("projectId와 nodeId가 필요합니다.");

  const res = await fetch(
    `/api/projects/${encodeURIComponent(pid)}/knowledge-trace/${encodeURIComponent(nid)}`,
    { credentials: "include", cache: "no-store" },
  );
  const json = (await res.json()) as ApiEnvelope<ProjectKnowledgeTraceResult>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? "Trace를 불러오지 못했습니다.");
  }
  return json.data;
}
