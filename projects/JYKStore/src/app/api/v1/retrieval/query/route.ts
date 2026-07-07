import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, requireApiKeyScope } from "@/lib/api-key-auth";
import { createRequestId, recordApiUsage } from "@/lib/api-usage-service";
import {
  DEFAULT_TOP_K,
  RETRIEVAL_QUERY_MAX_LENGTH,
  type RetrievalRequestBody,
} from "@/lib/retrieval-dto";
import { normalizeTopK, validateAndNormalizeFilters } from "@/lib/retrieval-filter";
import { retrieveContexts } from "@/lib/retrieval-service";

type AuthErrorCode = "UNAUTHORIZED" | "FORBIDDEN";

function validationError(requestId: string, details: string[]) {
  return NextResponse.json(
    {
      error: {
        code: "INVALID_RETRIEVAL_REQUEST",
        message: "Invalid retrieval request.",
        details,
      },
      usage: { requestId },
    },
    { status: 400 },
  );
}

function simpleError(requestId: string, code: string, message: string, status: number) {
  return NextResponse.json(
    { error: { code, message }, usage: { requestId } },
    { status },
  );
}

async function parseJsonBody(request: NextRequest): Promise<RetrievalRequestBody | null> {
  try {
    return (await request.json()) as RetrievalRequestBody;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = createRequestId();
  const endpoint = request.nextUrl.pathname;
  const method = request.method;

  let apiKeyId: string | null = null;
  let packId: string | undefined;

  try {
    const auth = requireApiKeyScope(await authenticateApiKey(request), "context:read");
    if (!auth.ok) {
      const code: AuthErrorCode = auth.status === 403 ? "FORBIDDEN" : "UNAUTHORIZED";
      await recordApiUsage({
        requestId,
        apiKeyId: null,
        endpoint,
        method,
        statusCode: auth.status,
        latencyMs: Date.now() - startedAt,
        metadata: { reason: code },
      });
      return simpleError(requestId, code, auth.error, auth.status);
    }

    apiKeyId = auth.apiKeyId;

    const body = await parseJsonBody(request);
    if (!body) {
      await recordApiUsage({
        requestId,
        apiKeyId,
        endpoint,
        method,
        statusCode: 400,
        latencyMs: Date.now() - startedAt,
        metadata: { reason: "INVALID_JSON" },
      });
      return validationError(requestId, ["Request body must be valid JSON."]);
    }

    const details: string[] = [];

    const packIdValid =
      typeof body.knowledgePackId === "string" && body.knowledgePackId.trim().length > 0;
    if (!packIdValid) {
      details.push("knowledgePackId must be a non-empty string.");
    } else {
      packId = (body.knowledgePackId as string).trim();
    }

    if (body.query !== undefined && typeof body.query !== "string") {
      details.push("query must be a string.");
    }
    if (body.includeMetadata !== undefined && typeof body.includeMetadata !== "boolean") {
      details.push("includeMetadata must be a boolean.");
    }

    const topKResult = normalizeTopK(body.topK);
    if (!topKResult.ok) details.push(topKResult.error);

    const filterResult = validateAndNormalizeFilters(body.filters);
    if (!filterResult.ok) details.push(...filterResult.errors);

    if (details.length > 0) {
      await recordApiUsage({
        requestId,
        apiKeyId,
        packId,
        endpoint,
        method,
        statusCode: 400,
        latencyMs: Date.now() - startedAt,
        metadata: { reason: "INVALID_RETRIEVAL_REQUEST" },
      });
      return validationError(requestId, details);
    }

    const knowledgePackId = (body.knowledgePackId as string).trim();
    const topK = topKResult.ok ? topKResult.topK : DEFAULT_TOP_K;
    const filters = filterResult.ok ? filterResult.filters : {};
    const query = typeof body.query === "string" ? body.query.trim() || undefined : undefined;
    const safeQuery = query?.slice(0, RETRIEVAL_QUERY_MAX_LENGTH);
    const includeMetadata = body.includeMetadata === undefined ? true : Boolean(body.includeMetadata);

    const result = await retrieveContexts({
      knowledgePackId,
      query,
      filters,
      topK,
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
      return simpleError(requestId, "PACK_NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
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
        chunkCount: result.usage.contextCount,
        query: safeQuery,
        topK,
        includeMetadata,
        filterKeys: Object.keys(filters),
        searchMode: query ? "keyword-metadata-ranking" : "metadata-ranking",
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/v1/retrieval/query failed", error);
    await recordApiUsage({
      requestId,
      apiKeyId,
      packId,
      endpoint,
      method,
      statusCode: 500,
      latencyMs: Date.now() - startedAt,
      metadata: { error: "INTERNAL_SERVER_ERROR" },
    });
    return simpleError(requestId, "INTERNAL_SERVER_ERROR", "서버 오류가 발생했습니다.", 500);
  }
}
