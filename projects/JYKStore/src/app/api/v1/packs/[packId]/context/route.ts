import { NextRequest, NextResponse } from "next/server";
import { createRequestId, recordApiUsage } from "@/lib/api-usage-service";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { PUBLIC_API_REQUIRED_SCOPE } from "@/lib/api-key-service";
import { getPackContext, parseContextLimit, parseIncludeMetadata } from "@/lib/context-service";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "API_KEY_REVOKED"
  | "API_KEY_EXPIRED"
  | "INSUFFICIENT_SCOPE"
  | "PACK_NOT_FOUND"
  | "INVALID_REQUEST"
  | "INTERNAL_SERVER_ERROR";

function jsonError(
  requestId: string,
  code: ErrorCode,
  message: string,
  status: number,
) {
  return NextResponse.json(
    {
      error: { code, message },
      usage: { requestId },
    },
    { status },
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const startedAt = Date.now();
  const requestId = createRequestId();
  const endpoint = request.nextUrl.pathname;
  const method = request.method;

  let apiKeyId: string | null = null;
  let packId = "";

  try {
    const auth = await authenticateApiKey(request, {
      requiredScope: PUBLIC_API_REQUIRED_SCOPE,
      requestId,
    });
    if (!auth.ok) {
      await recordApiUsage({
        requestId,
        apiKeyId: null,
        endpoint,
        method,
        statusCode: auth.status,
        latencyMs: Date.now() - startedAt,
        metadata: { reason: auth.code },
      });
      return jsonError(requestId, auth.code, auth.error, auth.status);
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
      await recordApiUsage({
        requestId,
        apiKeyId,
        packId,
        endpoint,
        method,
        query: q,
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
      query: q,
      statusCode: 200,
      latencyMs: Date.now() - startedAt,
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
      path: endpoint,
      requestId,
      error,
    });
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
