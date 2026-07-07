import { NextRequest } from "next/server";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { submitProviderPackForReview } from "@/lib/provider-pack-service";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const { packId } = await context.params;

  try {
    const result = await submitProviderPackForReview(clientId, packId?.trim() ?? "");

    if (result.error === "NOT_FOUND") {
      return jsonWithClientIdCookie({ error: "지식팩을 찾을 수 없습니다." }, clientId, { status: 404 });
    }
    if (result.error === "NOT_DRAFT") {
      return jsonWithClientIdCookie(
        { error: "초안(DRAFT) 상태에서만 검수 요청할 수 있습니다." },
        clientId,
        { status: 409 },
      );
    }
    if (result.error === "INCOMPLETE") {
      return jsonWithClientIdCookie({ error: result.message }, clientId, { status: 400 });
    }

    return jsonWithClientIdCookie({ clientId, pack: result.pack }, clientId);
  } catch (error) {
    console.error("POST /api/v1/provider/packs/[packId]/submit failed", error);
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
