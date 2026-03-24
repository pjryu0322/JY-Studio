import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

const MOCK_USER_HEADER = "x-mock-user-id";

function readCookieFromHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(`${name}=`)) {
      return decodeURIComponent(p.slice(name.length + 1));
    }
  }
  return null;
}

function readSessionCookieFromRequest(request: Request | NextRequest): string | null {
  if ("cookies" in request && typeof (request as NextRequest).cookies?.get === "function") {
    const v = (request as NextRequest).cookies.get(SESSION_COOKIE_NAME)?.value;
    if (v) {
      return v;
    }
  }
  return readCookieFromHeader(request.headers.get("cookie"), SESSION_COOKIE_NAME);
}

/**
 * Resolves the signed-in user id from the HTTP-only session cookie.
 * In non-production, `x-mock-user-id` is honored for manual / integration testing only.
 */
export async function getSessionUserIdFromRequest(
  request: Request | NextRequest
): Promise<string | null> {
  if (process.env.NODE_ENV !== "production") {
    const mock = request.headers.get(MOCK_USER_HEADER)?.trim();
    if (mock) {
      return mock;
    }
  }
  const raw = readSessionCookieFromRequest(request);
  if (!raw) {
    return null;
  }
  return verifySessionToken(raw);
}

/** @deprecated Use {@link getSessionUserIdFromRequest} (async). */
export async function getCurrentUserIdFromRequest(
  request: Request | NextRequest
): Promise<string | null> {
  return getSessionUserIdFromRequest(request);
}

export function mockUserIdHeaderName(): typeof MOCK_USER_HEADER {
  return MOCK_USER_HEADER;
}
