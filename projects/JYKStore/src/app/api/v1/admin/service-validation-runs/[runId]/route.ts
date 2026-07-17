import { NextRequest } from "next/server";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { rejectUnlessAdmin } from "@/lib/admin-route-guard";
import { getAdminServiceValidationRun } from "@/lib/distribution/service-validation-service";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = { params: Promise<{ runId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminDeny = await rejectUnlessAdmin(request, clientId);
  if (adminDeny) return adminDeny;
  const { runId } = await context.params;
  try {
    const run = await getAdminServiceValidationRun(runId?.trim() ?? "");
    if (!run) {
      return jsonWithClientIdCookie(
        { error: "NOT_FOUND", message: "검증 실행을 찾을 수 없습니다." },
        clientId,
        { status: 404 },
      );
    }
    return jsonWithClientIdCookie({ clientId, run }, clientId);
  } catch (error) {
    logSafeRouteError({
      scope: "admin/service-validation-runs",
      method: "GET",
      path: "/api/v1/admin/service-validation-runs/[runId]",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}
