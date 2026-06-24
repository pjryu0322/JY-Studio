import type { KnowledgeRuntimeStatusSummary } from "@/lib/project-knowledge/projectKnowledgeRuntimeStatusTypes";

type ApiEnvelope<T> = { success?: boolean; message?: string; data?: T };

export async function fetchKnowledgeRuntimeStatus(
  projectId: string,
): Promise<KnowledgeRuntimeStatusSummary> {
  const pid = projectId.trim();
  if (!pid) throw new Error("projectId가 필요합니다.");

  const res = await fetch(`/api/projects/${encodeURIComponent(pid)}/knowledge-runtime/status`, {
    credentials: "include",
    cache: "no-store",
  });
  const json = (await res.json()) as ApiEnvelope<KnowledgeRuntimeStatusSummary>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? "구조화 상태를 불러오지 못했습니다.");
  }
  return json.data;
}
