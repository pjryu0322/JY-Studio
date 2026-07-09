import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import type { OpsRange } from "@/lib/ops-dto";
import { getOpsSummary } from "@/lib/ops-service";
import { rejectUnlessAdminOps } from "@/lib/admin-route-guard";

export async function GET(request: NextRequest) {
  const clientId = ensureClientId(request);
  const adminDeny = rejectUnlessAdminOps(request, clientId);
  if (adminDeny) return adminDeny;

  try {
    const rawRange = request.nextUrl.searchParams.get("range");
    const range: OpsRange = rawRange === "7d" ? "7d" : "24h";
    const summary = await getOpsSummary(range);
    return jsonWithClientIdCookie({ clientId, summary }, clientId);
  } catch (error) {
    logSafeRouteError({ scope: "admin-ops-summary", method: "GET", path: "/api/v1/admin/ops/summary", error });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
