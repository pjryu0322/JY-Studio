import { NextRequest, NextResponse } from "next/server";
import { createRequestId, recordApiUsage } from "@/lib/api-usage-service";
import { authenticateApiKey, requireApiKeyScope } from "@/lib/api-key-auth";
import { getPackContext, parseContextLimit } from "@/lib/context-service";
import { tokenizeSearchQuery } from "@/lib/search-utils";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "PACK_NOT_FOUND"
  | "INVALID_REQUEST"
  | "INTERNAL_SERVER_ERROR";

type ContextQueryBody = {
  query?: string;
  limit?: number;
  includeMetadata?: boolean;
};

function jsonError(requestId: string, code: ErrorCode, message: string, status: number) {
  return NextResponse.json(
    {
      error: { code, message },
      usage: { requestId },
    },
    { status },
  );
}

async function parseJsonBody(request: NextRequest): Promise<ContextQueryBody | null> {
  try {
    return (await request.json()) as ContextQueryBody;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const startedAt = Date.now();
  const requestId = createRequestId();
  const endpoint = request.nextUrl.pathname;
  const method = request.method;

  let apiKeyId: string | null = null;
  let packId = "";

  try {
    const auth = requireApiKeyScope(await authenticateApiKey(request), "context:read");
    if (!auth.ok) {
      const code = auth.status === 403 ? "FORBIDDEN" : "UNAUTHORIZED";
      await recordApiUsage({
        requestId,
        apiKeyId: null,
        endpoint,
        method,
        statusCode: auth.status,
        latencyMs: Date.now() - startedAt,
        metadata: { reason: code },
      });
      return jsonError(requestId, code, auth.error, auth.status);
    }

    apiKeyId = auth.apiKeyId;

    const { packId: routePackId } = await context.params;
    packId = routePackId?.trim() ?? "";

    if (!packId) {
      await recordApiUsage({
        requestId,
        apiKeyId,
        endpoint,
        method,
        statusCode: 400,
        latencyMs: Date.now() - startedAt,
        metadata: { reason: "INVALID_REQUEST" },
      });
      return jsonError(requestId, "INVALID_REQUEST", "packId가 필요합니다.", 400);
    }

    const body = await parseJsonBody(request);
    if (!body) {
      await recordApiUsage({
        requestId,
        apiKeyId,
        packId,
        endpoint,
        method,
        statusCode: 400,
        latencyMs: Date.now() - startedAt,
        metadata: { reason: "INVALID_JSON" },
      });
      return jsonError(requestId, "INVALID_REQUEST", "요청 본문이 올바른 JSON이 아닙니다.", 400);
    }

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
      await recordApiUsage({
        requestId,
        apiKeyId,
        packId,
        endpoint,
        method,
        query: safeQuery,
        statusCode: 404,
        latencyMs: Date.now() - startedAt,
        metadata: { reason: "PACK_NOT_FOUND", packId },
      });
      return jsonError(requestId, "PACK_NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
    }

    await recordApiUsage({
      requestId,
      apiKeyId,
      packId,
      endpoint,
      method,
      query: safeQuery,
      statusCode: 200,
      latencyMs: Date.now() - startedAt,
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
  } catch (error) {
    console.error("POST /api/v1/packs/[packId]/context/query failed", error);
    await recordApiUsage({
      requestId,
      apiKeyId,
      packId: packId || undefined,
      endpoint,
      method,
      statusCode: 500,
      latencyMs: Date.now() - startedAt,
      metadata: { error: "INTERNAL_SERVER_ERROR" },
    });
    return jsonError(requestId, "INTERNAL_SERVER_ERROR", "서버 오류가 발생했습니다.", 500);
  }
}
