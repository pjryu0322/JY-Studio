import { NextRequest } from "next/server";
import { listRegisteredAccounts } from "@/lib/admin-accounts-service";
import { rejectUnlessAdmin } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { logSafeRouteError } from "@/lib/safe-logging";

export async function GET(request: NextRequest) {
  const clientId = ensureClientId(request);
  const adminDeny = await rejectUnlessAdmin(request, clientId);
  if (adminDeny) return adminDeny;

  try {
    const items = await listRegisteredAccounts();
    return jsonWithClientIdCookie({ clientId, items }, clientId);
  } catch (error) {
    logSafeRouteError({
      scope: "admin-accounts",
      method: "GET",
      path: "/api/v1/admin/accounts",
      error,
    });
    return jsonWithClientIdCookie(
      { error: "등록 계정 목록을 불러오지 못했습니다." },
      clientId,
      { status: 500 },
    );
  }
}
