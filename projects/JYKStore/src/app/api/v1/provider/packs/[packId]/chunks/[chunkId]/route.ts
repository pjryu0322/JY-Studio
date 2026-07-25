import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { getProviderChunkReviewDetailForClient } from "@/lib/provider-pack/provider-chunk-review-detail-service";

type RouteContext = {
  params: Promise<{ packId: string; chunkId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId, chunkId } = await context.params;

  try {
    const detail = await getProviderChunkReviewDetailForClient(
      userId,
      clientId,
      packId?.trim() ?? "",
      chunkId?.trim() ?? "",
    );
    if (!detail) {
      return jsonWithClientIdCookie(
        { error: "지식 단위를 찾을 수 없습니다." },
        clientId,
        { status: 404 },
      );
    }
    return jsonWithClientIdCookie({ clientId, chunk: detail }, clientId);
  } catch (error) {
    logSafeRouteError({
      scope: "provider-route",
      method: "GET",
      path: "/api/v1/provider/packs/[packId]/chunks/[chunkId]",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}
