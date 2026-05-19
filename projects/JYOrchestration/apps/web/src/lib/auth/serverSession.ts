import { cookies } from "next/headers";
import { findUserForSessionOrMe } from "@/lib/prisma/userPlatformFieldsCompat";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

/** JWT 서명만 확인(미들웨어와 동일 수준) */
export async function getSessionUserIdFromServerCookies(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;
  return verifySessionToken(raw);
}

/** 활성 플랫폼 사용자까지 확인 — Server Component 리다이렉트용 */
export async function getAuthenticatedUserIdFromServerCookies(): Promise<string | null> {
  const userId = await getSessionUserIdFromServerCookies();
  if (!userId) return null;
  try {
    const user = await findUserForSessionOrMe(userId);
    if (!user || user.accountStatus !== "ACTIVE") return null;
    return user.id;
  } catch (e) {
    console.error("getAuthenticatedUserIdFromServerCookies DB check failed:", e);
    return null;
  }
}
