import { NextRequest } from "next/server";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { rejectUnlessAdmin } from "@/lib/admin-route-guard";
import { getAdminQuotaSummary, type QuotaSummaryRange } from "@/lib/quota-service";
import { logSafeRouteError } from "@/lib/safe-logging";

export async function GET(request: NextRequest) {
  const clientId = ensureClientId(request);
  const adminDeny = await rejectUnlessAdmin(request, clientId);
  if (adminDeny) return adminDeny;

  try {
    const rangeParam = request.nextUrl.searchParams.get("range");
    const range: QuotaSummaryRange = rangeParam === "7d" ? "7d" : "24h";
    const filterClientId = request.nextUrl.searchParams.get("clientId")?.trim();

    const summary = await getAdminQuotaSummary({
      range,
      clientId: filterClientId || undefined,
    });

    return jsonWithClientIdCookie({ clientId, summary }, clientId);
  } catch (error) {
    logSafeRouteError({
      scope: "admin-quota",
      method: "GET",
      path: "/api/v1/admin/quota/summary",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
