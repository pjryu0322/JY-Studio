import { NextRequest } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { validateProviderSourceDocument } from "@/lib/provider-pack-service";

type RouteContext = {
  params: Promise<{ packId: string; sourceDocumentId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId, sourceDocumentId } = await context.params;

  try {
    const result = await validateProviderSourceDocument(
      userId,
      clientId,
      packId?.trim() ?? "",
      sourceDocumentId?.trim() ?? "",
    );

    if (result.error === "PROFILE_REQUIRED") {
      return jsonWithClientIdCookie(
        { error: "제공자 프로필을 먼저 등록해 주세요." },
        clientId,
        { status: 400 },
      );
    }
    if (result.error === "NOT_FOUND") {
      return jsonWithClientIdCookie({ error: "지식팩 또는 원천 문서를 찾을 수 없습니다." }, clientId, {
        status: 404,
      });
    }
    if (result.error === "NOT_EDITABLE") {
      return jsonWithClientIdCookie(
        { error: "초안(DRAFT) 상태에서만 재검증할 수 있습니다." },
        clientId,
        { status: 409 },
      );
    }

    return jsonWithClientIdCookie({ clientId, pack: result.pack, report: result.report }, clientId);
  } catch (error) {
    console.error(
      "POST /api/v1/provider/packs/[packId]/source-documents/[sourceDocumentId]/validate failed",
      error,
    );
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
