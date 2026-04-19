/**
 * 플랫폼 전역 사용자 목록(관리자 뷰) 접근 권한.
 * - DB `users.globalRole === 'ADMIN'`
 * - 또는 서버 환경변수 `JY_PLATFORM_ADMIN_EMAILS`(쉼표 구분 이메일, 소문자 무시) — 로컬 MVP 편의용
 */
export function isPlatformAdminUser(globalRole: string | null | undefined, email: string | null | undefined): boolean {
  if (String(globalRole ?? "").trim().toUpperCase() === "ADMIN") return true;
  const raw = typeof process !== "undefined" ? String(process.env.JYO_PLATFORM_ADMIN_EMAILS ?? "").trim() : "";
  if (!raw || !email) return false;
  const allow = new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  return allow.has(email.trim().toLowerCase());
}
