import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "@/lib/auth/requestUser";

/**
 * Returns the signed-in user id, or a 401 JSON response if the session is missing/invalid.
 */
export async function requireSessionUserId(
  request: NextRequest | Request
): Promise<string | NextResponse> {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });
  }
  return userId;
}
