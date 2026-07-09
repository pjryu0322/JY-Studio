import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth-session";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";

export const LOGIN_REQUIRED_ERROR = {
  error: "LOGIN_REQUIRED" as const,
  message: "로그인이 필요합니다.",
};

export type LoggedInRequestContext = {
  clientId: string;
  userId: string;
};

export function requireLoggedInRequest(
  request: NextRequest,
): LoggedInRequestContext | NextResponse {
  const clientId = ensureClientId(request);
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return jsonWithClientIdCookie(LOGIN_REQUIRED_ERROR, clientId, { status: 401 });
  }
  return { clientId, userId };
}

export function isLoggedInResponse(ctx: LoggedInRequestContext | NextResponse): ctx is LoggedInRequestContext {
  return "userId" in ctx;
}
