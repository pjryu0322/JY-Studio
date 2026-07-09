import { NextRequest, NextResponse } from "next/server";
import { isLoggedInResponse, requireLoggedInRequest } from "@/lib/auth-guard";

export function requireProviderApiAuth(
  request: NextRequest,
): { ok: true; clientId: string; userId: string } | { ok: false; response: NextResponse } {
  const auth = requireLoggedInRequest(request);
  if (!isLoggedInResponse(auth)) {
    return { ok: false, response: auth };
  }
  return { ok: true, clientId: auth.clientId, userId: auth.userId };
}
