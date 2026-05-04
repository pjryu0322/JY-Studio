import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";

/**
 * 브라우저 세션 스토리지 키 — 멤버별 논리 네임스페이스로 분리(v2).
 * (v1 키 `jyo-ws-ai-entry:v1:…`는 더 이상 사용하지 않음)
 */
export function workspaceAiEntryNoticeStorageKey(projectId: string, memberId: WorkspaceAiMemberId): string {
  const pid = projectId.trim();
  return `jyo-ws-ai-entry:v2:m:${memberId}:p:${pid}`;
}

export function workspaceAiHandoffStorageKey(projectId: string): string {
  return `jyo-ws-ai-handoff:v1:p:${projectId.trim()}`;
}
