import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import { workspaceAiHandoffStorageKey } from "@/lib/ai-member/workspaceAiMemoryNamespace";

export type WorkspaceAiHandoffPayload = {
  readonly targetMemberId: WorkspaceAiMemberId;
  readonly fromMemberId: WorkspaceAiMemberId;
  readonly snippet: string;
  readonly savedAt: string;
};

function readRaw(projectId: string): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return sessionStorage.getItem(workspaceAiHandoffStorageKey(projectId));
  } catch {
    return null;
  }
}

function writeRaw(projectId: string, raw: string | null): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const key = workspaceAiHandoffStorageKey(projectId);
    if (raw == null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, raw);
  } catch {
    /* quota / private mode */
  }
}

export function publishWorkspaceAiScreenHandoff(projectId: string, payload: Omit<WorkspaceAiHandoffPayload, "savedAt">): void {
  const pid = projectId.trim();
  const snippet = payload.snippet.trim();
  if (!pid || !snippet) return;
  const full: WorkspaceAiHandoffPayload = {
    ...payload,
    snippet,
    savedAt: new Date().toISOString(),
  };
  writeRaw(pid, JSON.stringify(full));
}

/**
 * `forMemberId`가 대기 중인 handoff 대상과 일치할 때만 본문을 반환하고 저장소를 비운다(일회성).
 */
export function consumeWorkspaceAiScreenHandoff(projectId: string, forMemberId: WorkspaceAiMemberId): string {
  const pid = projectId.trim();
  if (!pid) return "";
  const raw = readRaw(pid);
  if (!raw) return "";
  let parsed: WorkspaceAiHandoffPayload;
  try {
    parsed = JSON.parse(raw) as WorkspaceAiHandoffPayload;
  } catch {
    writeRaw(pid, null);
    return "";
  }
  if (!parsed || parsed.targetMemberId !== forMemberId) return "";
  const from = String(parsed.fromMemberId ?? "").trim();
  const body = String(parsed.snippet ?? "").trim();
  writeRaw(pid, null);
  if (!body) return "";
  const fromLine = from ? `이전 담당: ${from}` : "이전 담당: (알 수 없음)";
  return `${fromLine}\n요약:\n${body}`.slice(0, 4500);
}
