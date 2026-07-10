import type { NextRequest, NextResponse } from "next/server";
import { isAdminAccountRole } from "@/lib/account-role";
import { getStoreAuthSessionFromRequest } from "@/lib/auth-session";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { getStoreUserById } from "@/lib/store-auth-service";

export type AdminSessionSuccess = {
  ok: true;
  mode: "account";
  adminUserId: string;
  adminEmail: string | null;
  clientId: string;
};

export type AdminSessionFailure = {
  ok: false;
  status: 401 | 403;
  code: "ADMIN_AUTH_REQUIRED" | "ADMIN_ROLE_REQUIRED";
  message: string;
};

export type AdminSessionResult = AdminSessionSuccess | AdminSessionFailure;

/**
 * Require a logged-in store user with accountRole ADMIN.
 */
export async function requireAdminSession(
  request: NextRequest,
  clientId: string,
): Promise<AdminSessionResult> {
  const session = getStoreAuthSessionFromRequest(request);
  if (!session?.userId) {
    return {
      ok: false,
      status: 401,
      code: "ADMIN_AUTH_REQUIRED",
      message: "관리자 권한이 필요합니다. 관리자 계정으로 로그인해 주세요.",
    };
  }

  const user = await getStoreUserById(session.userId);
  if (!user || !isAdminAccountRole(user.accountRole)) {
    return {
      ok: false,
      status: 403,
      code: "ADMIN_ROLE_REQUIRED",
      message: "관리자 권한이 필요합니다. 관리자 계정으로 로그인해 주세요.",
    };
  }

  return {
    ok: true,
    mode: "account",
    adminUserId: user.id,
    adminEmail: user.email,
    clientId,
  };
}

/** Alias used by admin API routes. */
export async function requireAdminAccount(
  request: NextRequest,
  clientId: string,
): Promise<AdminSessionResult> {
  return requireAdminSession(request, clientId);
}

/**
 * Returns a denial response when admin account check fails; null when allowed.
 */
export async function rejectUnlessAdmin(
  request: NextRequest,
  clientId: string,
): Promise<NextResponse | null> {
  const adminAuth = await requireAdminSession(request, clientId);
  if (!adminAuth.ok) {
    return jsonWithClientIdCookie(
      { error: { code: adminAuth.code, message: adminAuth.message } },
      clientId,
      { status: adminAuth.status },
    );
  }
  return null;
}
