import type { NextRequest } from "next/server";

function truthy(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes((value?.trim() ?? "").toLowerCase());
}

/** Flag enabled and not production. Production always fails closed. */
export function isTestAccountSwitcherConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.NODE_ENV === "production") return false;
  return truthy(env.JYKSTORE_ENABLE_TEST_ACCOUNT_SWITCHER);
}

/** Loopback or RFC1918 private LAN — never public internet hosts. */
export function isPrivateOrLoopbackHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return true;
  }

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4) return false;
  const octets = ipv4.slice(1).map((part) => Number(part));
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = octets as [number, number, number, number];
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

/**
 * Dev-only hosts that may call the switcher APIs.
 * Allows loopback and private LAN so local device testing works; public hostnames stay blocked.
 */
export function isLocalTestAccountRequest(request: NextRequest): boolean {
  try {
    const hostname = new URL(request.url).hostname.toLowerCase();
    return isPrivateOrLoopbackHostname(hostname);
  } catch {
    return false;
  }
}

export function canUseTestAccountSwitcher(
  request: NextRequest,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isTestAccountSwitcherConfigured(env) && isLocalTestAccountRequest(request);
}
