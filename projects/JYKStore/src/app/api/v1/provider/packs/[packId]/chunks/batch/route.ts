import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { listProviderChunkReviewDetailsForClient } from "@/lib/provider-pack/provider-chunk-review-detail-service";
import { PROVIDER_CHUNK_PDF_EXPORT_MAX } from "@/lib/provider-chunk-review";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;

  try {
    const body = (await request.json()) as { chunkIds?: unknown };
    const chunkIds = Array.isArray(body.chunkIds)
      ? body.chunkIds.filter((id): id is string => typeof id === "string")
      : [];
    if (chunkIds.length === 0) {
      return jsonWithClientIdCookie(
        { error: "지식 단위를 하나 이상 선택해 주세요." },
        clientId,
        { status: 400 },
      );
    }
    if (chunkIds.length > PROVIDER_CHUNK_PDF_EXPORT_MAX) {
      return jsonWithClientIdCookie(
        {
          error: `한 번에 최대 ${PROVIDER_CHUNK_PDF_EXPORT_MAX}건까지 내보낼 수 있습니다.`,
        },
        clientId,
        { status: 400 },
      );
    }

    const chunks = await listProviderChunkReviewDetailsForClient(
      userId,
      clientId,
      packId?.trim() ?? "",
      chunkIds,
      PROVIDER_CHUNK_PDF_EXPORT_MAX,
    );
    return jsonWithClientIdCookie({ clientId, chunks }, clientId);
  } catch (error) {
    logSafeRouteError({
      scope: "provider-route",
      method: "POST",
      path: "/api/v1/provider/packs/[packId]/chunks/batch",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}
