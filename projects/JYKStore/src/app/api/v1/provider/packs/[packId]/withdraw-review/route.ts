import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { withdrawProviderPackFromReview } from "@/lib/provider-pack-service";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;

  try {
    const result = await withdrawProviderPackFromReview(userId, clientId, packId?.trim() ?? "");

    if (result.error === "PROFILE_REQUIRED") {
      return jsonWithClientIdCookie(
        { error: "제공자 프로필이 필요합니다." },
        clientId,
        { status: 403 },
      );
    }
    if (result.error === "NOT_FOUND") {
      return jsonWithClientIdCookie({ error: "지식팩을 찾을 수 없습니다." }, clientId, { status: 404 });
    }
    if (result.error === "NOT_REVIEWING") {
      return jsonWithClientIdCookie(
        { error: "검수 중(REVIEWING) 상태의 지식팩만 회수할 수 있습니다." },
        clientId,
        { status: 409 },
      );
    }
    if (result.error === "ALREADY_ACCEPTED") {
      return jsonWithClientIdCookie(
        { error: "관리자가 이미 접수한 검수 요청은 회수할 수 없습니다." },
        clientId,
        { status: 409 },
      );
    }
    if (result.error === "NO_PENDING_REVIEW") {
      return jsonWithClientIdCookie(
        { error: "회수할 검수 요청이 없습니다." },
        clientId,
        { status: 409 },
      );
    }

    return jsonWithClientIdCookie({ clientId, pack: result.pack }, clientId);
  } catch (error) {
    logSafeRouteError({
      scope: "provider-route",
      method: "POST",
      path: "/api/v1/provider/packs/[packId]/withdraw-review",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
