import { NextRequest } from "next/server";
import { listApiKeysAdmin } from "@/lib/api-key-service";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { rejectUnlessAdmin } from "@/lib/admin-route-guard";
import { logSafeRouteError } from "@/lib/safe-logging";

export async function GET(request: NextRequest) {
  const clientId = ensureClientId(request);
  const adminDeny = await rejectUnlessAdmin(request, clientId);
  if (adminDeny) return adminDeny;

  try {
    const statusParam = request.nextUrl.searchParams.get("status")?.trim();
    const filterClientId = request.nextUrl.searchParams.get("clientId")?.trim();
    const status =
      statusParam === "ACTIVE" || statusParam === "REVOKED" || statusParam === "EXPIRED"
        ? statusParam
        : undefined;

    const apiKeys = await listApiKeysAdmin({
      status,
      clientId: filterClientId || undefined,
    });

    return jsonWithClientIdCookie({ clientId, apiKeys }, clientId);
  } catch (error) {
    logSafeRouteError({
      scope: "admin-api-key",
      method: "GET",
      path: "/api/v1/admin/api-keys",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
