import { NextRequest, NextResponse } from "next/server";
import { getPackContext, parseContextLimit, parseIncludeMetadata } from "@/lib/context-service";
import {
  apiErrorResponse,
  createPublicApiContext,
  internalServerErrorResponse,
  recordPublicApiUsage,
  requireContextReadApiKey,
  requireQuota,
} from "@/lib/public-api-handler";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

export async function GET(request: NextRequest, routeContext: RouteContext) {
  const publicContext = createPublicApiContext(request);
  const { requestId } = publicContext;

  try {
    const auth = await requireContextReadApiKey(publicContext);
    if (!auth.ok) return auth.response;

    const quota = await requireQuota(publicContext);
    if (!quota.ok) return quota.response;

    const { packId: routePackId } = await routeContext.params;
    const packId = routePackId?.trim() ?? "";
    publicContext.packId = packId || undefined;

    if (!packId) {
      await recordPublicApiUsage(publicContext, {
        statusCode: 400,
        metadata: { reason: "INVALID_REQUEST" },
      });
      return apiErrorResponse(requestId, "INVALID_REQUEST", "packId가 필요합니다.", 400);
    }

    const q = request.nextUrl.searchParams.get("q")?.trim() ?? undefined;
    const limit = parseContextLimit(request.nextUrl.searchParams.get("limit"));
    const includeMetadata = parseIncludeMetadata(request.nextUrl.searchParams.get("includeMetadata"));

    const result = await getPackContext({
      packId,
      query: q,
      limit,
      includeMetadata,
      requestId,
    });

    if (!result) {
      await recordPublicApiUsage(publicContext, {
        statusCode: 404,
        query: q,
        metadata: { reason: "PACK_NOT_FOUND", packId },
      });
      return apiErrorResponse(requestId, "PACK_NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
    }

    await recordPublicApiUsage(publicContext, {
      statusCode: 200,
      query: q,
      metadata: {
        chunkCount: result.usage.chunkCount,
        query: q,
        limit,
        includeMetadata,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    logSafeRouteError({
      scope: "context",
      method: "GET",
      path: publicContext.endpoint,
      requestId,
      error,
    });
    await recordPublicApiUsage(publicContext, {
      statusCode: 500,
      metadata: { error: "INTERNAL_SERVER_ERROR" },
    });
    return internalServerErrorResponse(requestId);
  }
}
