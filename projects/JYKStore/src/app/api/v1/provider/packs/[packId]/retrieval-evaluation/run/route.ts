import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { runProviderPackRetrievalEvaluation } from "@/lib/provider-pack-service";

type RouteContext = { params: Promise<{ packId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const { packId } = await context.params;

  try {
    const result = await runProviderPackRetrievalEvaluation(clientId, packId?.trim() ?? "");

    if ("error" in result) {
      if (result.error === "PROFILE_REQUIRED") {
        return jsonWithClientIdCookie(
          { error: "제공자 프로필을 먼저 등록해 주세요." },
          clientId,
          { status: 400 },
        );
      }
      if (result.error === "NOT_FOUND") {
        return jsonWithClientIdCookie({ error: "지식팩을 찾을 수 없습니다." }, clientId, {
          status: 404,
        });
      }
      if (result.error === "NOT_EDITABLE") {
        return jsonWithClientIdCookie(
          { error: "초안(DRAFT) 상태에서만 검색 품질 평가를 실행할 수 있습니다." },
          clientId,
          { status: 409 },
        );
      }
      if (result.error === "INCOMPLETE") {
        return jsonWithClientIdCookie({ error: result.message }, clientId, { status: 400 });
      }
    }

    return jsonWithClientIdCookie({ clientId, pack: result.pack }, clientId);
  } catch (error) {
    logSafeRouteError({ scope: "provider-route", method: "POST", path: "/api/v1/provider/packs/[packId]/retrieval-evaluation/run", error });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
