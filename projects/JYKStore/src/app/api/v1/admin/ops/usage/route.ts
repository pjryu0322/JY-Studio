import { NextRequest } from "next/server";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { listOpsUsageLogs } from "@/lib/ops-service";
import { rejectUnlessAdminOps } from "@/lib/admin-route-guard";

export async function GET(request: NextRequest) {
  const clientId = ensureClientId(request);
  const adminDeny = rejectUnlessAdminOps(request, clientId);
  if (adminDeny) return adminDeny;

  try {
    const params = request.nextUrl.searchParams;
    const rawLimit = params.get("limit");
    const rawStatus = params.get("status");
    const status = rawStatus === "success" || rawStatus === "error" ? rawStatus : undefined;

    const items = await listOpsUsageLogs({
      limit: rawLimit ? Number(rawLimit) : undefined,
      status,
      endpoint: params.get("endpoint") ?? undefined,
      packId: params.get("packId") ?? undefined,
    });

    return jsonWithClientIdCookie({ clientId, items }, clientId);
  } catch (error) {
    console.error("GET /api/v1/admin/ops/usage failed", error);
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
