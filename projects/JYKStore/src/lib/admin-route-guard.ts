import type { NextRequest, NextResponse } from "next/server";
import { verifyAdminOpsRequest } from "@/lib/admin-auth";
import { isAdminAccountRole } from "@/lib/account-role";
import { getStoreAuthSessionFromRequest } from "@/lib/auth-session";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { getStoreUserById } from "@/lib/store-auth-service";

export type AdminSessionSuccess = {
  ok: true;
  mode: "account" | "ops_token";
  adminUserId: string | null;
  adminEmail: string | null;
  clientId: string;
};

export type AdminSessionFailure = {
  ok: false;
  status: 401 | 403;
  code: "ADMIN_AUTH_REQUIRED" | "ADMIN_AUTH_INVALID" | "ADMIN_ROLE_REQUIRED";
  message: string;
};

export type AdminSessionResult = AdminSessionSuccess | AdminSessionFailure;

/**
 * Prefer logged-in ADMIN account; fall back to Admin Ops Token for bootstrap/dev.
 */
export async function requireAdminSession(
  request: NextRequest,
  clientId: string,
): Promise<AdminSessionResult> {
  const session = getStoreAuthSessionFromRequest(request);
  if (session?.userId) {
    const user = await getStoreUserById(session.userId);
    if (user && isAdminAccountRole(user.accountRole)) {
      return {
        ok: true,
        mode: "account",
        adminUserId: user.id,
        adminEmail: user.email,
        clientId,
      };
    }
    if (user && !isAdminAccountRole(user.accountRole)) {
      // Logged in but not admin — still allow ops token fallback below.
    }
  }

  const opsAuth = verifyAdminOpsRequest(request);
  if (opsAuth.ok) {
    return {
      ok: true,
      mode: "ops_token",
      adminUserId: session?.userId ?? null,
      adminEmail: session?.email ?? null,
      clientId,
    };
  }

  if (session?.userId) {
    return {
      ok: false,
      status: 403,
      code: "ADMIN_ROLE_REQUIRED",
      message: "관리자 권한이 필요합니다. 관리자 계정으로 로그인해 주세요.",
    };
  }

  return {
    ok: false,
    status: opsAuth.status,
    code: opsAuth.code,
    message:
      opsAuth.code === "ADMIN_AUTH_INVALID"
        ? opsAuth.message
        : "관리자 권한이 필요합니다. 관리자 계정으로 로그인해 주세요.",
  };
}

/**
 * Returns a denial response when admin session/ops check fails; null when allowed.
 * Prefer reading the success result via requireAdminSession when adminUserId is needed.
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

/** @deprecated Prefer rejectUnlessAdmin / requireAdminSession. Kept for transitional call sites. */
export async function rejectUnlessAdminOps(
  request: NextRequest,
  clientId: string,
): Promise<NextResponse | null> {
  return rejectUnlessAdmin(request, clientId);
}
