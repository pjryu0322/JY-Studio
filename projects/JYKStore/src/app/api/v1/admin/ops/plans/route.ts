import { NextRequest } from "next/server";
import { getAdminPlanOverview } from "@/lib/billing-service";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { rejectUnlessAdminOps } from "@/lib/admin-route-guard";

export async function GET(request: NextRequest) {
  const clientId = ensureClientId(request);
  const adminDeny = rejectUnlessAdminOps(request, clientId);
  if (adminDeny) return adminDeny;

  try {
    const overview = await getAdminPlanOverview();
    return jsonWithClientIdCookie({ clientId, overview }, clientId);
  } catch (error) {
    console.error("GET /api/v1/admin/ops/plans failed", error);
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
