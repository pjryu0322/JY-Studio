import type {
  KnowledgeGraphRevisionDetail,
  KnowledgeGraphRevisionListItem,
} from "@/lib/project-knowledge/projectKnowledgeGraphRevisionTypes";

type ApiEnvelope<T> = { success?: boolean; message?: string; data?: T };

export async function fetchKnowledgeGraphRevisions(
  projectId: string,
): Promise<KnowledgeGraphRevisionListItem[]> {
  const pid = projectId.trim();
  if (!pid) throw new Error("projectId가 필요합니다.");

  const res = await fetch(`/api/projects/${encodeURIComponent(pid)}/knowledge-graph/revisions`, {
    credentials: "include",
    cache: "no-store",
  });
  const json = (await res.json()) as ApiEnvelope<{ revisions?: KnowledgeGraphRevisionListItem[] }>;
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? "그래프 변화 기록을 불러오지 못했습니다.");
  }
  return json.data?.revisions ?? [];
}

export async function fetchKnowledgeGraphRevision(
  projectId: string,
  revisionId: string,
): Promise<KnowledgeGraphRevisionDetail> {
  const pid = projectId.trim();
  const rid = revisionId.trim();
  if (!pid || !rid) throw new Error("조회 정보가 부족합니다.");

  const res = await fetch(
    `/api/projects/${encodeURIComponent(pid)}/knowledge-graph/revisions/${encodeURIComponent(rid)}`,
    { credentials: "include", cache: "no-store" },
  );
  const json = (await res.json()) as ApiEnvelope<{ revision?: KnowledgeGraphRevisionDetail }>;
  if (!res.ok || !json.success || !json.data?.revision) {
    throw new Error(json.message ?? "해당 시점 그래프를 불러오지 못했습니다.");
  }
  return json.data.revision;
}
