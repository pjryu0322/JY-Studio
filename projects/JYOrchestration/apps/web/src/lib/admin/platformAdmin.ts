/**
 * 플랫폼 전역 권한(프로젝트 RBAC와 별개).
 * - `users.globalRole`: USER | ADMIN | SUPER_ADMIN
 * - `JY_PLATFORM_ADMIN_EMAILS`(쉼표 구분, 대소문자 무시) — 로컬·부트스트랩용 ADMIN 권한 부여
 * - 정식 서비스 전 완화: `isPrereleasePlatformAdminUnlocked()` (로컬 기본 ON, 프로덕션은 env로만 ON)
 */

/**
 * 로그인한 사용자에게 플랫폼 관리 UI·`/api/admin/*` 접근을 넓힐지(정식 오픈 전).
 * - `JY_PRERELEASE_PLATFORM_ADMIN=1|true|yes` → 항상 완화
 * - `JY_PRERELEASE_PLATFORM_ADMIN=0|false|no` → 항상 엄격(역할·이메일만)
 * - 미설정 + `NODE_ENV === "production"` → 엄격
 * - 미설정 + 비프로덕션(`next dev` 등) → 완화
 */
export function isPrereleasePlatformAdminUnlocked(): boolean {
  const raw = String(process.env.JY_PRERELEASE_PLATFORM_ADMIN ?? "").trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "no") return false;
  if (process.env.NODE_ENV === "production") return false;
  return true;
}

/** 세션 사용자 기준: 관리 콘솔·`/api/auth/me`의 `isPlatformAdmin`에 사용 */
export function hasEffectivePlatformAdminAccess(
  globalRole: string | null | undefined,
  email: string | null | undefined
): boolean {
  if (isPrereleasePlatformAdminUnlocked()) return true;
  return isPlatformAdminUser(globalRole, email);
}

export type NormalizedPlatformRole = "USER" | "ADMIN" | "SUPER_ADMIN";

export function normalizePlatformRole(globalRole: string | null | undefined): NormalizedPlatformRole {
  const r = String(globalRole ?? "").trim().toUpperCase();
  if (r === "SUPER_ADMIN" || r === "SUPERADMIN") return "SUPER_ADMIN";
  if (r === "ADMIN") return "ADMIN";
  return "USER";
}

function envAdminEmails(): Set<string> {
  const raw = typeof process !== "undefined" ? String(process.env.JYO_PLATFORM_ADMIN_EMAILS ?? "").trim() : "";
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

/** DB 또는 환경변수로 플랫폼 관리자 콘솔(사용자 목록 등) 접근 가능 */
export function isPlatformAdminUser(globalRole: string | null | undefined, email: string | null | undefined): boolean {
  const role = normalizePlatformRole(globalRole);
  if (role === "ADMIN" || role === "SUPER_ADMIN") return true;
  const e = String(email ?? "").trim().toLowerCase();
  if (!e) return false;
  return envAdminEmails().has(e);
}

export function isSuperAdminUser(globalRole: string | null | undefined): boolean {
  return normalizePlatformRole(globalRole) === "SUPER_ADMIN";
}

/** 관리자 콘솔 API·페이지 — ADMIN / SUPER_ADMIN / 환경변수 부트스트랩 / 프리릴리즈 완화 */
export function canAccessPlatformAdminConsole(
  globalRole: string | null | undefined,
  email: string | null | undefined
): boolean {
  return hasEffectivePlatformAdminAccess(globalRole, email);
}
