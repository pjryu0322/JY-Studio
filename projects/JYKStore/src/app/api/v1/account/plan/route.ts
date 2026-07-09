import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { getAccountPlanSummary } from "@/lib/billing-service";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";

export async function GET(request: NextRequest) {
  const clientId = ensureClientId(request);

  try {
    const summary = await getAccountPlanSummary(clientId);
    return jsonWithClientIdCookie({ clientId, summary }, clientId);
  } catch (error) {
    logSafeRouteError({ scope: "account-route", method: "GET", path: "/api/v1/account/plan", error });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
