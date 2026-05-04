/** 플랫폼 전역 프로필(닉네임·표시 이름) — 프로젝트 멤버 displayName 과 별개 */

export const MAX_PLATFORM_NICKNAME_LENGTH = 48;

export type AuthMeDataWire = {
  id: string;
  email?: string | null;
  name?: string | null;
  nickname?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
};

export function platformUserDisplayName(
  nickname: string | null | undefined,
  legalName: string | null | undefined
): string {
  const nick = String(nickname ?? "").trim();
  if (nick.length > 0) return nick.slice(0, MAX_PLATFORM_NICKNAME_LENGTH);
  const legal = String(legalName ?? "").trim();
  if (legal.length > 0) return legal;
  return "사용자";
}

export function normalizeNicknameInput(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  return s.slice(0, MAX_PLATFORM_NICKNAME_LENGTH);
}

/** 워크스페이스 등 세션 표시용: API `/api/auth/me` 응답 → `{ name: 표시명 }` */
export function sessionUserFromAuthMe(data: AuthMeDataWire): {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
} {
  const displayName =
    String(data.displayName ?? "").trim() || platformUserDisplayName(data.nickname, data.name);
  const av = String(data.avatarUrl ?? "").trim();
  return {
    id: data.id,
    email: String(data.email ?? "").trim(),
    name: displayName,
    avatarUrl: av || null,
  };
}
