import type {
  KnowledgeGraphRevisionDetail,
  KnowledgeGraphRevisionListItem,
} from "@/lib/project-knowledge/projectKnowledgeGraphRevisionTypes";

type ApiEnvelope<T> = { success?: boolean; message?: string; data?: T };

async function readApiEnvelope<T>(res: Response): Promise<ApiEnvelope<T>> {
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();
  if (!text.trim()) {
    throw new Error("서버 응답이 비어 있습니다.");
  }
  if (!contentType.includes("application/json") && text.trimStart().startsWith("<")) {
    throw new Error("그래프 API 응답 형식이 올바르지 않습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.");
  }
  try {
    return JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    throw new Error("그래프 API 응답을 해석하지 못했습니다.");
  }
}

export async function fetchKnowledgeGraphRevisions(
  projectId: string,
): Promise<KnowledgeGraphRevisionListItem[]> {
  const pid = projectId.trim();
  if (!pid) throw new Error("projectId가 필요합니다.");

  const res = await fetch(`/api/projects/${encodeURIComponent(pid)}/knowledge-graph/revisions`, {
    credentials: "include",
    cache: "no-store",
  });
  const json = await readApiEnvelope<{ revisions?: KnowledgeGraphRevisionListItem[] }>(res);
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

  const params = new URLSearchParams({ revisionId: rid });
  const res = await fetch(
    `/api/projects/${encodeURIComponent(pid)}/knowledge-graph/revisions?${params.toString()}`,
    { credentials: "include", cache: "no-store" },
  );
  const json = await readApiEnvelope<{ revision?: KnowledgeGraphRevisionDetail }>(res);
  if (!res.ok || !json.success || !json.data?.revision) {
    throw new Error(json.message ?? "해당 시점 그래프를 불러오지 못했습니다.");
  }
  return json.data.revision;
}
