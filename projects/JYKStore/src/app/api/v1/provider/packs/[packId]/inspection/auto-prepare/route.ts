import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { runProviderPackInspectionAutoPrepare } from "@/lib/provider-pack-service";

type RouteContext = { params: Promise<{ packId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;

  try {
    let runRetrievalEvaluation = true;
    let repairRetrievalData = false;
    try {
      const body = (await request.json()) as {
        runRetrievalEvaluation?: unknown;
        repairRetrievalData?: unknown;
      };
      if (typeof body?.runRetrievalEvaluation === "boolean") {
        runRetrievalEvaluation = body.runRetrievalEvaluation;
      }
      if (typeof body?.repairRetrievalData === "boolean") {
        repairRetrievalData = body.repairRetrievalData;
      }
    } catch {
      // optional body
    }

    const result = await runProviderPackInspectionAutoPrepare(
      userId,
      clientId,
      packId?.trim() ?? "",
      { runRetrievalEvaluation, repairRetrievalData },
    );

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
        { error: "초안(DRAFT) 상태에서만 자동 점검을 실행할 수 있습니다." },
        clientId,
        { status: 409 },
      );
    }

    return jsonWithClientIdCookie(
      { clientId, pack: result.pack, preparation: result.preparation },
      clientId,
    );
  } catch (error) {
    logSafeRouteError({
      scope: "provider-route",
      method: "POST",
      path: "/api/v1/provider/packs/[packId]/inspection/auto-prepare",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}
