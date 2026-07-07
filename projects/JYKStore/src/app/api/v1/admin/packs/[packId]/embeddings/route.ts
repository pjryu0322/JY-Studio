import { NextRequest } from "next/server";
import { getPackEmbeddingSummary } from "@/lib/chunk-embedding-service";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";

type RouteContext = { params: Promise<{ packId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const { packId } = await context.params;

  try {
    const summary = await getPackEmbeddingSummary(packId?.trim() ?? "");
    if (!summary) {
      return jsonWithClientIdCookie({ error: "지식팩을 찾을 수 없습니다." }, clientId, { status: 404 });
    }
    return jsonWithClientIdCookie({ clientId, ...summary }, clientId);
  } catch (error) {
    console.error("GET pack embeddings failed", error);
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
