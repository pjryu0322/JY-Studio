import { NextRequest } from "next/server";
import { listReviewingPacks } from "@/lib/admin-review-service";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";

export async function GET(request: NextRequest) {
  const clientId = ensureClientId(request);

  try {
    const items = await listReviewingPacks();
    return jsonWithClientIdCookie({ clientId, items }, clientId);
  } catch (error) {
    console.error("GET /api/v1/admin/reviews failed", error);
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
