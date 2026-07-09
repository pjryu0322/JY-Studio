import type { NextRequest, NextResponse } from "next/server";
import { requireLoggedInRequest, isLoggedInResponse } from "@/lib/auth-guard";
import { jsonWithClientIdCookie } from "@/lib/client-identity";

export async function withLoggedInProvider<T>(
  request: NextRequest,
  handler: (ctx: { clientId: string; userId: string }) => Promise<NextResponse<T>>,
): Promise<NextResponse> {
  const auth = requireLoggedInRequest(request);
  if (!isLoggedInResponse(auth)) {
    return auth;
  }
  return handler(auth);
}

export function providerProfileRequiredResponse(clientId: string) {
  return jsonWithClientIdCookie(
    {
      error: "PROFILE_REQUIRED",
      message: "제공자 프로필이 필요합니다.",
    },
    clientId,
    { status: 403 },
  );
}
