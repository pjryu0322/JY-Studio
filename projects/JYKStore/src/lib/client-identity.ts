import { NextRequest, NextResponse } from "next/server";

export const JYKSTORE_CLIENT_ID_COOKIE = "jykstore_client_id";

export function createClientId() {
  return `jyk_client_${crypto.randomUUID()}`;
}

export function getClientIdFromRequest(request: NextRequest) {
  return request.cookies.get(JYKSTORE_CLIENT_ID_COOKIE)?.value ?? null;
}

export function ensureClientId(request: NextRequest) {
  return getClientIdFromRequest(request) ?? createClientId();
}

export function attachClientIdCookie(response: NextResponse, clientId: string) {
  response.cookies.set(JYKSTORE_CLIENT_ID_COOKIE, clientId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}

export function withClientIdCookie<T>(
  request: NextRequest,
  body: T,
  init?: { status?: number },
): NextResponse {
  const existing = getClientIdFromRequest(request);
  const clientId = existing ?? createClientId();
  const response = NextResponse.json(body, { status: init?.status ?? 200 });

  if (!existing) {
    attachClientIdCookie(response, clientId);
  }

  return response;
}
