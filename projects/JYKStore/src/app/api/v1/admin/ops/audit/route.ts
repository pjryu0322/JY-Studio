import { NextRequest } from "next/server";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { listOpsAuditLogs } from "@/lib/ops-service";

export async function GET(request: NextRequest) {
  const clientId = ensureClientId(request);

  try {
    const params = request.nextUrl.searchParams;
    const rawLimit = params.get("limit");

    const items = await listOpsAuditLogs({
      limit: rawLimit ? Number(rawLimit) : undefined,
      action: params.get("action") ?? undefined,
      entityType: params.get("entityType") ?? undefined,
    });

    return jsonWithClientIdCookie({ clientId, items }, clientId);
  } catch (error) {
    console.error("GET /api/v1/admin/ops/audit failed", error);
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
