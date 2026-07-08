import { NextRequest } from "next/server";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { generateProviderPackRetrievalEvaluationCases } from "@/lib/provider-pack-service";

type RouteContext = { params: Promise<{ packId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const { packId } = await context.params;

  try {
    let replace: boolean | undefined;
    try {
      const body = (await request.json()) as { replace?: unknown };
      if (typeof body?.replace === "boolean") {
        replace = body.replace;
      }
    } catch {
      // optional body
    }

    const result = await generateProviderPackRetrievalEvaluationCases(
      clientId,
      packId?.trim() ?? "",
      replace,
    );

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
          { error: "초안(DRAFT) 상태에서만 검색 품질 평가 케이스를 생성할 수 있습니다." },
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
    console.error("POST provider retrieval-evaluation cases generate failed", error);
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
