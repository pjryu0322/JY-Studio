import { NextResponse } from "next/server";
import { createStoreAuthSessionToken, JYKSTORE_AUTH_SESSION_COOKIE } from "@/lib/auth-session";

export function attachAuthSessionCookie(response: NextResponse, session: { userId: string; email: string; name: string }) {
  const token = createStoreAuthSessionToken(session);
  response.cookies.set(JYKSTORE_AUTH_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

/** Clear using the same path/sameSite/secure/httpOnly attributes as attach. */
export function clearAuthSessionCookie(response: NextResponse) {
  response.cookies.set(JYKSTORE_AUTH_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
