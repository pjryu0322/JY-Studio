import { NextRequest } from "next/server";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { getOpsHealth } from "@/lib/ops-service";

export async function GET(request: NextRequest) {
  const clientId = ensureClientId(request);

  try {
    const health = await getOpsHealth();
    return jsonWithClientIdCookie({ clientId, health }, clientId);
  } catch (error) {
    console.error("GET /api/v1/admin/ops/health failed", error);
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
