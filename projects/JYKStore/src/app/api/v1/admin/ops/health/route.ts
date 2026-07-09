import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { getOpsHealth } from "@/lib/ops-service";
import { rejectUnlessAdminOps } from "@/lib/admin-route-guard";

export async function GET(request: NextRequest) {
  const clientId = ensureClientId(request);
  const adminDeny = rejectUnlessAdminOps(request, clientId);
  if (adminDeny) return adminDeny;

  try {
    const health = await getOpsHealth();
    return jsonWithClientIdCookie({ clientId, health }, clientId);
  } catch (error) {
    logSafeRouteError({ scope: "admin-ops-health", method: "GET", path: "/api/v1/admin/ops/health", error });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
