import crypto from "crypto";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

/** Dev email login session (signed httpOnly cookie). TODO: replace with durable DB session + OAuth. */
export const JYKSTORE_AUTH_SESSION_COOKIE = "jykstore_auth_session";

const SESSION_TTL_SEC = 60 * 60 * 24 * 30;

export type StoreAuthSession = {
  userId: string;
  email: string;
  name: string;
  exp: number;
};

function sessionSecret(): string {
  const secret = process.env.JYKSTORE_API_KEY_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JYKSTORE_API_KEY_SECRET is required for auth sessions in production");
  }
  return "jykstore-dev-auth-session-secret";
}

function signPayload(encodedPayload: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(encodedPayload).digest("base64url");
}

export function createStoreAuthSessionToken(session: Omit<StoreAuthSession, "exp">): string {
  const payload: StoreAuthSession = {
    ...session,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${signPayload(encoded)}`;
}

export function parseStoreAuthSessionToken(token: string | null | undefined): StoreAuthSession | null {
  if (!token?.trim()) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = signPayload(encoded);
  try {
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
      return null;
    }
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as StoreAuthSession;
    if (!parsed.userId || !parsed.email || !parsed.name || !parsed.exp) return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getStoreAuthSessionFromRequest(request: NextRequest): StoreAuthSession | null {
  const token = request.cookies.get(JYKSTORE_AUTH_SESSION_COOKIE)?.value;
  return parseStoreAuthSessionToken(token);
}

export function getUserIdFromRequest(request: NextRequest): string | null {
  return getStoreAuthSessionFromRequest(request)?.userId ?? null;
}

export async function getStoreAuthSessionFromCookies(): Promise<StoreAuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(JYKSTORE_AUTH_SESSION_COOKIE)?.value;
  return parseStoreAuthSessionToken(token);
}

export async function getUserIdFromCookies(): Promise<string | null> {
  const session = await getStoreAuthSessionFromCookies();
  return session?.userId ?? null;
}

export function isLoggedInRequest(request: NextRequest): boolean {
  return Boolean(getUserIdFromRequest(request));
}
