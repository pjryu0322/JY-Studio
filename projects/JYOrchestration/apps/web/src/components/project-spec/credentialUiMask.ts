/**
 * API가 `has*Token` 플래그 없이 마스크만 주는 경우·구버전 호환을 위해 저장 여부를 넓게 판별합니다.
 */
export function githubCredentialLooksStored(
  es: { hasGithubAccessToken?: boolean; githubAccessTokenMasked?: string | null } | null | undefined
): boolean {
  if (!es) return false;
  if (es.hasGithubAccessToken === true) return true;
  return Boolean(String(es.githubAccessTokenMasked ?? "").trim());
}

export function cursorCredentialLooksStored(
  es: { hasCursorToken?: boolean; cursorApiTokenMasked?: string | null } | null | undefined
): boolean {
  if (!es) return false;
  if (es.hasCursorToken === true) return true;
  return Boolean(String(es.cursorApiTokenMasked ?? "").trim());
}

/** 마스크가 없어도 저장된 비밀값이 있으면 점만 표시해 빈 칸처럼 보이지 않게 합니다. */
export function secretMaskedDisplay(
  masked: string | null | undefined,
  revealedPlaintext: string | null | undefined,
  looksStored: boolean
): string {
  if (revealedPlaintext) return revealedPlaintext;
  const m = String(masked ?? "").trim();
  if (m) return m;
  if (looksStored) return "•••••••• (저장됨)";
  return "";
}

/** 동일 소유자의 다른 프로젝트에서 온 힌트(GET `peerCredentialHints`) */
export function peerGithubCredentialMasked(
  es: { peerCredentialHints?: { githubAccessTokenMasked?: string | null } | null } | null | undefined
): string | null {
  const m = String(es?.peerCredentialHints?.githubAccessTokenMasked ?? "").trim();
  return m || null;
}

export function peerCursorCredentialMasked(
  es: { peerCredentialHints?: { cursorApiTokenMasked?: string | null } | null } | null | undefined
): string | null {
  const m = String(es?.peerCredentialHints?.cursorApiTokenMasked ?? "").trim();
  return m || null;
}

export function peerCursorCredentialUrl(
  es: { peerCredentialHints?: { cursorApiUrl?: string | null } | null } | null | undefined
): string | null {
  const u = String(es?.peerCredentialHints?.cursorApiUrl ?? "").trim();
  return u || null;
}
