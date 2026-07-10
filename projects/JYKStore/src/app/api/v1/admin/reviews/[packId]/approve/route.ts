import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { approvePackReview } from "@/lib/admin-review-service";
import { ensureClientId, getClientIdFromRequest, jsonWithClientIdCookie } from "@/lib/client-identity";
import { requireAdminSession } from "@/lib/admin-route-guard";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

async function parseJsonBody(request: NextRequest) {
  try {
    return (await request.json()) as { memo?: string; publishAsVerified?: boolean };
  } catch {
    return null;
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

  try {
    const body = await parseJsonBody(request);
    if (!body) {
      return jsonWithClientIdCookie({ error: "요청 본문이 올바른 JSON이 아닙니다." }, clientId, {
        status: 400,
      });
    }

    const result = await approvePackReview({
      packId: packId?.trim() ?? "",
      reviewerClientId: getClientIdFromRequest(request) ?? clientId,
      reviewerUserId: adminAuth.adminUserId,
      memo: body.memo,
      publishAsVerified: body.publishAsVerified,
    });

    if (result.error === "NOT_FOUND") {
      return jsonWithClientIdCookie({ error: "지식팩을 찾을 수 없습니다." }, clientId, { status: 404 });
    }
    if (result.error === "NOT_REVIEWING") {
      return jsonWithClientIdCookie(
        { error: "검수 중(REVIEWING) 상태의 지식팩만 승인할 수 있습니다." },
        clientId,
        { status: 409 },
      );
    }
    if (result.error === "NOT_ACCEPTED") {
      return jsonWithClientIdCookie(
        { error: "검수 접수 후에만 승인할 수 있습니다." },
        clientId,
        { status: 409 },
      );
    }
    if (result.error === "INCOMPLETE") {
      return jsonWithClientIdCookie({ error: result.message }, clientId, { status: 400 });
    }

    return jsonWithClientIdCookie({ clientId, detail: result.detail }, clientId);
  } catch (error) {
    logSafeRouteError({ scope: "admin-review", method: "POST", path: "/api/v1/admin/reviews/[packId]/approve", error });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
