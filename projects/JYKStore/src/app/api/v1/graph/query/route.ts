import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, requireApiKeyScope } from "@/lib/api-key-auth";
import { createRequestId, recordApiUsage } from "@/lib/api-usage-service";
import {
  GRAPH_QUERY_DEFAULT_LIMIT,
  GRAPH_QUERY_MAX_LIMIT,
  GRAPH_QUERY_MIN_LIMIT,
  type KnowledgeGraphQueryRequestBody,
} from "@/lib/knowledge-graph-dto";
import { queryKnowledgeGraph } from "@/lib/knowledge-graph-service";

type AuthErrorCode = "UNAUTHORIZED" | "FORBIDDEN";

const QUERY_MAX_LENGTH = 200;

function validationError(requestId: string, details: string[]) {
  return NextResponse.json(
    {
      error: {
        code: "INVALID_GRAPH_QUERY_REQUEST",
        message: "Invalid graph query request.",
        details,
      },
      usage: { requestId },
    },
    { status: 400 },
  );
}

function simpleError(requestId: string, code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message }, usage: { requestId } }, { status });
}

async function parseJsonBody(request: NextRequest): Promise<KnowledgeGraphQueryRequestBody | null> {
  try {
    return (await request.json()) as KnowledgeGraphQueryRequestBody;
  } catch {
    return null;
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
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
    if (body.nodeTypes !== undefined && !isStringArray(body.nodeTypes)) {
      details.push("nodeTypes must be an array of strings.");
    }
    if (body.edgeTypes !== undefined && !isStringArray(body.edgeTypes)) {
      details.push("edgeTypes must be an array of strings.");
    }
    if (body.includeEdges !== undefined && typeof body.includeEdges !== "boolean") {
      details.push("includeEdges must be a boolean.");
    }

    let limit = GRAPH_QUERY_DEFAULT_LIMIT;
    if (body.limit !== undefined) {
      if (typeof body.limit !== "number" || !Number.isFinite(body.limit)) {
        details.push("limit must be a number.");
      } else if (body.limit < GRAPH_QUERY_MIN_LIMIT || body.limit > GRAPH_QUERY_MAX_LIMIT) {
        details.push(`limit must be between ${GRAPH_QUERY_MIN_LIMIT} and ${GRAPH_QUERY_MAX_LIMIT}.`);
      } else {
        limit = Math.floor(body.limit);
      }
    }

    if (details.length > 0) {
      await recordApiUsage({
        requestId,
        apiKeyId,
        packId,
        endpoint,
        method,
        statusCode: 400,
        latencyMs: Date.now() - startedAt,
        metadata: { reason: "INVALID_GRAPH_QUERY_REQUEST" },
      });
      return validationError(requestId, details);
    }

    const knowledgePackId = (body.knowledgePackId as string).trim();
    const query = typeof body.query === "string" ? body.query.trim() || undefined : undefined;
    const safeQuery = query?.slice(0, QUERY_MAX_LENGTH);
    const nodeTypes = isStringArray(body.nodeTypes) ? body.nodeTypes : undefined;
    const edgeTypes = isStringArray(body.edgeTypes) ? body.edgeTypes : undefined;
    const includeEdges = body.includeEdges === undefined ? true : Boolean(body.includeEdges);

    const result = await queryKnowledgeGraph({
      knowledgePackId,
      query,
      nodeTypes,
      edgeTypes,
      limit,
      includeEdges,
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
        query: safeQuery,
        nodeCount: result.usage.nodeCount,
        edgeCount: result.usage.edgeCount,
        nodeTypes,
        edgeTypes,
        limit,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/v1/graph/query failed", error);
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
