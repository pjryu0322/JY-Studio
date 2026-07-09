import { NextRequest, NextResponse } from "next/server";
import { getPackContext, parseContextLimit } from "@/lib/context-service";
import {
  apiErrorResponse,
  parseJsonBodySafe,
  recordPublicApiUsage,
} from "@/lib/public-api-handler";
import { withPublicApiGateway } from "@/lib/public-api-route";
import { tokenizeSearchQuery } from "@/lib/search-utils";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

type ContextQueryBody = {
  query?: string;
  limit?: number;
  includeMetadata?: boolean;
};

export async function POST(request: NextRequest, routeContext: RouteContext) {
  return withPublicApiGateway({
    request,
    scope: "context",
    handler: async (publicContext) => {
      const { requestId } = publicContext;

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

      const parsed = await parseJsonBodySafe<ContextQueryBody>(publicContext.request);
      if (!parsed.ok) {
        await recordPublicApiUsage(publicContext, {
          statusCode: 400,
          metadata: { reason: "INVALID_JSON" },
        });
        return apiErrorResponse(requestId, "INVALID_REQUEST", "요청 본문이 올바른 JSON이 아닙니다.", 400);
      }
      const body = parsed.body;

      const q = body.query?.trim() ?? undefined;
      const safeQuery = q?.slice(0, 100);
      const limit =
        typeof body.limit === "number" ? parseContextLimit(String(body.limit)) : parseContextLimit(null);
      const includeMetadata =
        body.includeMetadata === undefined ? true : Boolean(body.includeMetadata);

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
          query: safeQuery,
          metadata: { reason: "PACK_NOT_FOUND", packId },
        });
        return apiErrorResponse(requestId, "PACK_NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
      }

      await recordPublicApiUsage(publicContext, {
        statusCode: 200,
        query: safeQuery,
        metadata: {
          chunkCount: result.usage.chunkCount,
          query: safeQuery,
          limit,
          includeMetadata,
          searchMode: q ? "keyword-ranking" : "default",
          queryTokenCount: tokenizeSearchQuery(q).length,
          returnedCount: result.usage.chunkCount,
        },
      });

      return NextResponse.json(result);
    },
  });
}
