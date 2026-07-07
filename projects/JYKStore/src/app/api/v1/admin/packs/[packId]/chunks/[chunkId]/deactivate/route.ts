import { NextRequest } from "next/server";
import { deactivateKnowledgeChunk } from "@/lib/chunk-pipeline-service";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";

type RouteContext = { params: Promise<{ packId: string; chunkId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const { packId, chunkId } = await context.params;

  try {
    const result = await deactivateKnowledgeChunk({
      packId: packId?.trim() ?? "",
      chunkId: chunkId?.trim() ?? "",
    });

    if (result.error === "NOT_FOUND") {
      return jsonWithClientIdCookie({ error: "청크를 찾을 수 없습니다." }, clientId, { status: 404 });
    }

    return jsonWithClientIdCookie({ clientId, chunk: result.chunk, summary: result.summary }, clientId);
  } catch (error) {
    console.error("POST deactivate chunk failed", error);
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
