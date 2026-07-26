import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { getAdminReviewDetail } from "@/lib/admin-review-service";
import {
  acceptAdminProviderSupplement,
  clarifyAdminProviderSupplement,
  rejectAdminProviderSupplement,
  requestProviderReviewAgainAfterSupplement,
  resolveAdminProviderSupplement,
  resolveStoreWorkflowMarkers,
} from "@/lib/store-workflow-markers";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = { params: Promise<{ packId: string }> };

type Body = {
  action?: string;
  resolutionNote?: string;
  rejectionReason?: string;
  clarifyMessage?: string;
  nextAdminStep?: "NONE" | "WORKER_REPROCESS" | "QUALITY_RECHECK";
};

/**
 * Admin: accept / resolve / reject / clarify provider 보완요청.
 * GET returns current supplement state from workflow markers.
 */
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
  const trimmed = packId?.trim() ?? "";

  try {
    const markers = await resolveStoreWorkflowMarkers(trimmed);
    return jsonWithClientIdCookie(
      {
        ok: true,
        clientId,
        packId: trimmed,
        providerSupplementPhase: markers.providerSupplementPhase,
        providerSupplement: markers.providerSupplement,
        providerSupplementSubmittedAt: markers.providerSupplementSubmittedAt,
      },
      clientId,
      { status: 200 },
    );
  } catch (error) {
    logSafeRouteError({
      scope: "admin/provider-supplement",
      method: "GET",
      path: "/api/v1/admin/packs/[packId]/provider-supplement",
      error,
    });
    return jsonWithClientIdCookie(
      { error: "서버 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      clientId,
      { status: 500 },
    );
  }
}

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

    const body = (await request.json().catch(() => ({}))) as Body;
    const action = (body.action ?? "").trim().toUpperCase();

    let result;
    if (action === "ACCEPT") {
      result = await acceptAdminProviderSupplement({
        packId: trimmed,
        clientId,
      });
    } else if (action === "RESOLVE") {
      result = await resolveAdminProviderSupplement({
        packId: trimmed,
        clientId,
        resolutionNote: body.resolutionNote ?? "",
        nextAdminStep: body.nextAdminStep,
      });
    } else if (action === "REJECT") {
      result = await rejectAdminProviderSupplement({
        packId: trimmed,
        clientId,
        rejectionReason: body.rejectionReason ?? "",
      });
    } else if (action === "CLARIFY") {
      result = await clarifyAdminProviderSupplement({
        packId: trimmed,
        clientId,
        clarifyMessage: body.clarifyMessage ?? "",
      });
    } else if (action === "REQUEST_PROVIDER_REVIEW_AGAIN") {
      result = await requestProviderReviewAgainAfterSupplement({
        packId: trimmed,
        clientId,
      });
    } else {
      return jsonWithClientIdCookie(
        {
          ok: false,
          error: "INVALID_ACTION",
          message:
            "action은 ACCEPT, RESOLVE, REJECT, CLARIFY, REQUEST_PROVIDER_REVIEW_AGAIN 중 하나여야 합니다.",
        },
        clientId,
        { status: 400 },
      );
    }

    if (!result.ok) {
      return jsonWithClientIdCookie(
        { ok: false, error: result.error, message: result.message },
        clientId,
        { status: 409 },
      );
    }

    return jsonWithClientIdCookie(
      {
        ok: true,
        clientId,
        packId: trimmed,
        providerSupplementPhase: result.state.adminPhase,
        providerSupplement: result.state,
      },
      clientId,
      { status: 200 },
    );
  } catch (error) {
    logSafeRouteError({
      scope: "admin/provider-supplement",
      method: "POST",
      path: "/api/v1/admin/packs/[packId]/provider-supplement",
      error,
    });
    return jsonWithClientIdCookie(
      { error: "서버 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      clientId,
      { status: 500 },
    );
  }
}
