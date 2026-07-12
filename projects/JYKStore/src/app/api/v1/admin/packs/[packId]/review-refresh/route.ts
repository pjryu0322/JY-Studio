import { NextRequest } from "next/server";
import { refreshAdminReviewReadiness } from "@/lib/admin-review-refresh-service";
import { rejectUnlessAdmin } from "@/lib/admin-route-guard";
import { ensureClientId, getClientIdFromRequest, jsonWithClientIdCookie } from "@/lib/client-identity";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = { params: Promise<{ packId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminDeny = await rejectUnlessAdmin(request, clientId);
  if (adminDeny) return adminDeny;
  const { packId } = await context.params;

  try {
    const result = await refreshAdminReviewReadiness({
      packId: packId?.trim() ?? "",
      reviewerClientId: getClientIdFromRequest(request) ?? clientId,
    });

    if ("error" in result) {
      if (result.error === "NOT_FOUND") {
        return jsonWithClientIdCookie({ error: "지식팩을 찾을 수 없습니다." }, clientId, {
          status: 404,
        });
      }
      return jsonWithClientIdCookie({ error: "전체 재점검에 실패했습니다." }, clientId, {
        status: 500,
      });
    }

    return jsonWithClientIdCookie(
      {
        clientId,
        detail: result.detail,
        stepsCompleted: result.stepsCompleted,
        warnings: result.warnings,
        stoppedAt: result.stoppedAt,
      },
      clientId,
    );
  } catch (error) {
    logSafeRouteError({
      scope: "admin-pack-review-refresh",
      method: "POST",
      path: "/api/v1/admin/packs/[packId]/review-refresh",
      error,
    });
    return jsonWithClientIdCookie({ error: "전체 재점검에 실패했습니다." }, clientId, {
      status: 500,
    });
  }
}
