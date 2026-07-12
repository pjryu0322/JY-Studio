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

/** Only local loopback hosts may call the switcher APIs. */
export function isLocalTestAccountRequest(request: NextRequest): boolean {
  try {
    const hostname = new URL(request.url).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
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
