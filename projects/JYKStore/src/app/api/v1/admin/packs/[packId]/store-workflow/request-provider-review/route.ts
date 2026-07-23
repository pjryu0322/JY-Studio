import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { buildAdminQualityGateSnapshot } from "@/lib/role-workspace/admin-review-rail";
import { getAdminReviewDetail } from "@/lib/admin-review-service";
import { requestProviderStoreReview } from "@/lib/store-workflow-markers";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = { params: Promise<{ packId: string }> };

/**
 * Admin: after quality gate passes, request provider confirmation of generated knowledge.
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
    const detail = await getAdminReviewDetail(trimmed);
    if (!detail) {
      return jsonWithClientIdCookie(
        { ok: false, error: "NOT_FOUND", message: "지식팩을 찾을 수 없습니다." },
        clientId,
        { status: 404 },
      );
    }

    const quality = buildAdminQualityGateSnapshot(detail);
    if (!quality.completed || quality.hasBlockers || quality.failCount > 0) {
      return jsonWithClientIdCookie(
        {
          ok: false,
          error: "QUALITY_NOT_PASSED",
          message: "품질점검이 통과된 뒤에만 제공자 확인을 요청할 수 있습니다.",
        },
        clientId,
        { status: 409 },
      );
    }

    const result = await requestProviderStoreReview({
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
      { ok: true, clientId, packId: trimmed, providerReviewPhase: "REQUESTED" },
      clientId,
      { status: 200 },
    );
  } catch (error) {
    logSafeRouteError({
      scope: "admin/store-workflow/request-provider-review",
      method: "POST",
      path: "/api/v1/admin/packs/[packId]/store-workflow/request-provider-review",
      error,
    });
    return jsonWithClientIdCookie(
      { error: "서버 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      clientId,
      { status: 500 },
    );
  }
}
