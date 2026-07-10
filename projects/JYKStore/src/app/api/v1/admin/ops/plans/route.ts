import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { getAdminPlanOverview } from "@/lib/billing-service";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { rejectUnlessAdmin } from "@/lib/admin-route-guard";

export async function GET(request: NextRequest) {
  const clientId = ensureClientId(request);
  const adminDeny = await rejectUnlessAdmin(request, clientId);
  if (adminDeny) return adminDeny;

  try {
    const overview = await getAdminPlanOverview();
    return jsonWithClientIdCookie({ clientId, overview }, clientId);
  } catch (error) {
    logSafeRouteError({ scope: "admin-ops-plans", method: "GET", path: "/api/v1/admin/ops/plans", error });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
