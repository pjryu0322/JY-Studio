import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { markAdminServiceValidationPassed } from "@/lib/store-workflow-markers";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = { params: Promise<{ packId: string }> };

/**
 * Admin: persist service-validation completion (after provider confirm).
 */
export async function POST(request: NextRequest, context: RouteContext) {
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
  const trimmed = packId?.trim() ?? "";

  try {
    const result = await markAdminServiceValidationPassed({
      packId: trimmed,
      clientId,
    });
    if (!result.ok) {
      return jsonWithClientIdCookie(
        { ok: false, error: result.error, message: result.message },
        clientId,
        { status: 409 },
      );
    }

    return jsonWithClientIdCookie(
      { ok: true, clientId, packId: trimmed, serviceValidationPhase: "PASSED" },
      clientId,
      { status: 200 },
    );
  } catch (error) {
    logSafeRouteError({
      scope: "admin/store-workflow/service-validation",
      method: "POST",
      path: "/api/v1/admin/packs/[packId]/store-workflow/service-validation",
      error,
    });
    return jsonWithClientIdCookie(
      { error: "서버 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      clientId,
      { status: 500 },
    );
  }
}
