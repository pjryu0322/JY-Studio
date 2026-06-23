/** 프로젝트 레일·링크용 Knowledge Graph 생성 현황 URL */
export function buildProjectKnowledgeGraphActivityHref(
  projectId: string,
  sourceMessageId?: string | null,
): string {
  const pid = projectId.trim();
  const params = new URLSearchParams({ view: "activity", sync: "true" });
  const sid = String(sourceMessageId ?? "").trim();
  if (sid) params.set("sourceMessageId", sid);
  return `/projects/${encodeURIComponent(pid)}/knowledge-graph?${params.toString()}`;
}
