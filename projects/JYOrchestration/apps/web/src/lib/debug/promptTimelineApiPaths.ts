/** 프로젝트·대화방 공통 프롬프트 타임라인 조회 URL (연결 프로젝트가 있으면 프로젝트 API 우선) */
export function resolvePromptTimelineFetchUrl(input: {
  readonly projectId?: string | null;
  readonly roomId?: string | null;
}): string | null {
  const pid = String(input.projectId ?? "").trim();
  const rid = String(input.roomId ?? "").trim();
  if (pid) return `/api/projects/${encodeURIComponent(pid)}/debug/prompt-timeline`;
  if (rid) return `/api/chat-rooms/${encodeURIComponent(rid)}/debug/prompt-timeline`;
  return null;
}

export function resolvePromptTimelineExportStem(input: {
  readonly projectId?: string | null;
  readonly roomId?: string | null;
}): string {
  const pid = String(input.projectId ?? "").trim();
  const rid = String(input.roomId ?? "").trim();
  if (pid) return pid;
  if (rid) return `room-${rid}`;
  return "prompt-timeline";
}
