import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { publishNewRevisionAfterUnpublish } from "@/lib/admin-review-service";
import { ensureClientId, getClientIdFromRequest, jsonWithClientIdCookie } from "@/lib/client-identity";
import { requireAdminSession } from "@/lib/admin-route-guard";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

async function parseJsonBody(request: NextRequest) {
  try {
    return (await request.json()) as { memo?: string; publishAsVerified?: boolean };
  } catch {
    return {};
  }
}

/**
 * P9.1 — Publish a new DRAFT READY revision after unpublish (promote + publish).
 * Distinct from restore-publish (resume preserved PRODUCTION).
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

  try {
    const body = await parseJsonBody(request);
    const result = await publishNewRevisionAfterUnpublish({
      packId: packId?.trim() ?? "",
      reviewerClientId: getClientIdFromRequest(request) ?? clientId,
      reviewerUserId: adminAuth.adminUserId,
      memo: body.memo,
      publishAsVerified: body.publishAsVerified,
    });

    if (result.error === "NOT_FOUND") {
      return jsonWithClientIdCookie({ error: "지식팩을 찾을 수 없습니다." }, clientId, { status: 404 });
    }
    if (result.error === "NOT_UNPUBLISHED_DRAFT") {
      return jsonWithClientIdCookie(
        { error: "게시 중단된(DRAFT) 지식팩만 새 Revision을 게시할 수 있습니다." },
        clientId,
        { status: 409 },
      );
    }
    if (result.error === "INCOMPLETE") {
      return jsonWithClientIdCookie(
        { error: result.message, code: result.code },
        clientId,
        { status: 409 },
      );
    }
    if (result.error === "CONFLICT") {
      return jsonWithClientIdCookie({ error: result.message, code: result.code }, clientId, {
        status: 409,
      });
    }

    return jsonWithClientIdCookie(
      {
        clientId,
        detail: result.detail,
        reviewedGenerationId: result.reviewedGenerationId,
        publishedGenerationId: result.publishedGenerationId,
        servedGenerationId: result.servedGenerationId,
        versionId: result.versionId,
        status: result.status,
      },
      clientId,
    );
  } catch (error) {
    logSafeRouteError({
      scope: "admin-review",
      method: "POST",
      path: "/api/v1/admin/reviews/[packId]/publish-new-revision",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
