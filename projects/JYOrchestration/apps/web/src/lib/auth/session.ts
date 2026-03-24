import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "jyo_session";

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;

function resolveSecretRaw(): string {
  const raw = process.env.AUTH_SECRET?.trim();
  if (raw && raw.length >= 16) {
    return raw;
  }
  if (process.env.NODE_ENV !== "production") {
    return "dev-only-jyo-auth-secret-min-16-chars";
  }
  throw new Error("AUTH_SECRET must be set (min 16 characters) in production.");
}

/** HS256 key for jose (Route Handlers, middleware). */
export function getSessionSecretKey(): Uint8Array {
  return new TextEncoder().encode(resolveSecretRaw());
}

export async function signSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(getSessionSecretKey());
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecretKey());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export function sessionCookieMaxAgeSec(): number {
  return SESSION_MAX_AGE_SEC;
}

export function sessionCookieBaseOptions(): {
  httpOnly: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
  secure: boolean;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
    secure: process.env.NODE_ENV === "production",
  };
}
