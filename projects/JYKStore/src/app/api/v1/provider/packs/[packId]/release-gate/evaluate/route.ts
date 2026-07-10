import { NextRequest } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { evaluateProviderPackReleaseGate } from "@/lib/provider-pack-service";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = { params: Promise<{ packId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;

  try {
    const result = await evaluateProviderPackReleaseGate(userId, clientId, packId?.trim() ?? "");

    if (result.error === "PROFILE_REQUIRED") {
      return jsonWithClientIdCookie(
        { error: "제공자 프로필을 먼저 등록해 주세요." },
        clientId,
        { status: 400 },
      );
    }
    if (result.error === "NOT_FOUND") {
      return jsonWithClientIdCookie({ error: "지식팩을 찾을 수 없습니다." }, clientId, { status: 404 });
    }
    if (result.error === "NOT_EDITABLE") {
      return jsonWithClientIdCookie(
        { error: "초안(DRAFT) 상태에서만 릴리스 게이트를 실행할 수 있습니다." },
        clientId,
        { status: 400 },
      );
    }

    return jsonWithClientIdCookie({ clientId, pack: result.pack }, clientId);
  } catch (error) {
    logSafeRouteError({
      scope: "provider-pack-release-gate",
      method: "POST",
      path: "/api/v1/provider/packs/[packId]/release-gate/evaluate",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
