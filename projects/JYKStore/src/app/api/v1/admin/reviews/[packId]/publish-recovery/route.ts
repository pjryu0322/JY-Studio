import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { resolvePublishRecoveryForPack } from "@/lib/workflow/publish-recovery";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { requireAdminSession } from "@/lib/admin-route-guard";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

/** P9.1 — UI/server shared publish recovery mode (Restore Existing vs New Revision). */
export async function GET(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminAuth = await requireAdminSession(request, clientId);
  if (!adminAuth.ok) {
    return jsonWithClientIdCookie(
      { error: { code: adminAuth.code, message: adminAuth.message } },
      clientId,
      { status: adminAuth.status },
    );
  }
  const { packId } = await context.params;

  try {
    const recovery = await resolvePublishRecoveryForPack(packId?.trim() ?? "");
    if (recovery.code === "NOT_FOUND") {
      return jsonWithClientIdCookie({ error: "지식팩을 찾을 수 없습니다." }, clientId, { status: 404 });
    }
    return jsonWithClientIdCookie({ clientId, recovery }, clientId);
  } catch (error) {
    logSafeRouteError({
      scope: "admin-review",
      method: "GET",
      path: "/api/v1/admin/reviews/[packId]/publish-recovery",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
