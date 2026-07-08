import crypto from "crypto";

export const ADMIN_OPS_TOKEN_HEADER = "x-jykstore-admin-token";

export type AdminOpsAuthResult =
  | { ok: true }
  | {
      ok: false;
      status: 401 | 403;
      code: "ADMIN_AUTH_REQUIRED" | "ADMIN_AUTH_INVALID";
      message: string;
    };

export function isAdminOpsConfigured(): boolean {
  return Boolean(process.env.JYKSTORE_ADMIN_OPS_TOKEN?.trim());
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

function safeEqualStrings(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/**
 * Minimal Admin Ops Token gate (not OAuth/SSO).
 * - production: token env required; missing ⇒ 403
 * - development/test: token env optional (allow if unset); if set, header must match
 */
export function verifyAdminOpsRequest(request: Request): AdminOpsAuthResult {
  const configured = process.env.JYKSTORE_ADMIN_OPS_TOKEN?.trim() ?? "";

  if (!configured) {
    if (isProductionRuntime()) {
      return {
        ok: false,
        status: 403,
        code: "ADMIN_AUTH_REQUIRED",
        message: "Admin Ops Token이 서버에 설정되지 않았습니다.",
      };
    }
    // Dev/test only: allow when token is not configured.
    return { ok: true };
  }

  const headerValue =
    request.headers.get(ADMIN_OPS_TOKEN_HEADER) ??
    request.headers.get("X-JYKStore-Admin-Token");
  const provided = headerValue?.trim() ?? "";

  if (!provided) {
    return {
      ok: false,
      status: 401,
      code: "ADMIN_AUTH_REQUIRED",
      message: "Admin Ops Token이 필요합니다.",
    };
  }

  if (!safeEqualStrings(provided, configured)) {
    return {
      ok: false,
      status: 403,
      code: "ADMIN_AUTH_INVALID",
      message: "Admin Ops Token이 올바르지 않습니다.",
    };
  }

  return { ok: true };
}
