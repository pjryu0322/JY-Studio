import { NextRequest } from "next/server";
import { verifyAdminOpsRequest } from "@/lib/admin-auth";
import { listApiKeysAdmin } from "@/lib/api-key-service";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { logSafeRouteError } from "@/lib/safe-logging";

export async function GET(request: NextRequest) {
  const clientId = ensureClientId(request);

  try {
    const adminAuth = verifyAdminOpsRequest(request);
    if (!adminAuth.ok) {
      return jsonWithClientIdCookie(
        { error: { code: adminAuth.code, message: adminAuth.message } },
        clientId,
        { status: adminAuth.status },
      );
    }

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
