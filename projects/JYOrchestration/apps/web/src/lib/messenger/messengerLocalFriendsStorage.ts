import type { HumanMember } from "@/lib/messenger/messengerHomeMemberTypes";

const STORAGE_KEY = "jyo:messengerHomeFriends:v1";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** 브라우저에 저장된 친구 목록(서버 친구 API 도입 시 교체). */
export function loadMessengerFriendsFromStorage(): HumanMember[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: HumanMember[] = [];
    for (const row of parsed) {
      if (!isRecord(row)) continue;
      const id = String(row.id ?? "").trim();
      if (!id) continue;
      const displayName = String(row.displayName ?? "").trim() || id;
      const email = typeof row.email === "string" && row.email.trim() ? row.email.trim() : undefined;
      out.push({ id, displayName, email, status: "FRIEND" });
    }
    const seen = new Set<string>();
    return out.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  } catch {
    return [];
  }
}

export function saveMessengerFriendsToStorage(members: readonly HumanMember[]): void {
  if (typeof window === "undefined") return;
  try {
    const minimal = members.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      ...(m.email ? { email: m.email } : {}),
    }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
  } catch {
    /* ignore quota / private mode */
  }
}
