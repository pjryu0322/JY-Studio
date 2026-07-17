import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_TOP_K,
  RETRIEVAL_MODES,
  RETRIEVAL_QUERY_MAX_LENGTH,
  validateRetrievalQueryLength,
  type RetrievalMode,
  type RetrievalRequestBody,
} from "@/lib/retrieval-dto";
import { normalizeTopK, validateAndNormalizeFilters } from "@/lib/retrieval-filter";
import { executeRetrievalApiRequest } from "@/lib/retrieval/retrieval-api-adapter";
import {
  apiErrorResponse,
  createPublicApiContext,
  internalServerErrorResponse,
  mapAuthFailureToPublicCode,
  parseJsonBodySafe,
  recordPublicApiUsage,
  requireQuota,
  validationErrorResponse,
} from "@/lib/public-api-handler";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { PUBLIC_API_MCP_SCOPE } from "@/lib/api-key-service";
import { logSafeRouteError } from "@/lib/safe-logging";

function validationError(requestId: string, details: string[]) {
  return validationErrorResponse(
    requestId,
    "INVALID_RETRIEVAL_REQUEST",
    "Invalid retrieval request.",
    details,
  );
}

/**
 * MCP-trusted Retrieval path. Channel is fixed to MCP by this route.
 * Requires mcp:invoke scope — never trusts client X-JYK-Service-Channel.
 */
export async function POST(request: NextRequest) {
  const context = createPublicApiContext(request);
  const { requestId } = context;

  try {
    const auth = await authenticateApiKey(context.request, {
      requiredScope: PUBLIC_API_MCP_SCOPE,
      requestId,
    });
    if (!auth.ok) {
      const code = mapAuthFailureToPublicCode(auth.code);
      await recordPublicApiUsage(context, {
        statusCode: auth.status,
        metadata: { reason: code, serviceChannel: "MCP" },
      });
      return apiErrorResponse(requestId, code, auth.error, auth.status);
    }
    context.apiKeyId = auth.apiKeyId;
    context.clientId = auth.clientId;

    const quota = await requireQuota(context);
    if (!quota.ok) return quota.response;

    const spoofHeader = context.request.headers.get("x-jyk-service-channel");
    if (spoofHeader != null && spoofHeader.trim() !== "") {
      await recordPublicApiUsage(context, {
        statusCode: 400,
        metadata: { reason: "SERVICE_CHANNEL_SPOOFING_NOT_ALLOWED", serviceChannel: "MCP" },
      });
      return apiErrorResponse(
        requestId,
        "SERVICE_CHANNEL_SPOOFING_NOT_ALLOWED",
        "서비스 채널은 MCP 전용 경로에서 서버가 결정합니다.",
        400,
      );
    }

    const parsed = await parseJsonBodySafe<RetrievalRequestBody>(context.request);
    if (!parsed.ok) {
      await recordPublicApiUsage(context, { statusCode: 400, metadata: { reason: "INVALID_JSON" } });
      return validationError(requestId, ["Request body must be valid JSON."]);
    }
    const body = parsed.body;
    const details: string[] = [];

    const packIdValid =
      typeof body.knowledgePackId === "string" && body.knowledgePackId.trim().length > 0;
    if (!packIdValid) {
      details.push("knowledgePackId must be a non-empty string.");
    } else {
      context.packId = (body.knowledgePackId as string).trim();
    }

    if (body.includeMetadata !== undefined && typeof body.includeMetadata !== "boolean") {
      details.push("includeMetadata must be a boolean.");
    }
    if (
      body.retrievalMode !== undefined &&
      !RETRIEVAL_MODES.includes(body.retrievalMode as RetrievalMode)
    ) {
      details.push("retrievalMode must be one of: keyword, hybrid.");
    }

    const queryResult = validateRetrievalQueryLength(body.query);
    if (!queryResult.ok) details.push(queryResult.error);

    const topKResult = normalizeTopK(body.topK);
    if (!topKResult.ok) details.push(topKResult.error);

    const filterResult = validateAndNormalizeFilters(body.filters);
    if (!filterResult.ok) details.push(...filterResult.errors);

    if (details.length > 0) {
      await recordPublicApiUsage(context, {
        statusCode: 400,
        metadata: { reason: "INVALID_RETRIEVAL_REQUEST", serviceChannel: "MCP" },
      });
      return validationError(requestId, details);
    }

    const knowledgePackId = (body.knowledgePackId as string).trim();
    const topK = topKResult.ok ? topKResult.topK : DEFAULT_TOP_K;
    const filters = filterResult.ok ? filterResult.filters : {};
    const query = queryResult.ok ? queryResult.query : undefined;
    const safeQuery = query?.slice(0, RETRIEVAL_QUERY_MAX_LENGTH);
    const includeMetadata = body.includeMetadata === undefined ? true : Boolean(body.includeMetadata);
    const retrievalMode: RetrievalMode =
      (body.retrievalMode as RetrievalMode | undefined) ?? (query ? "hybrid" : "keyword");

    const result = await executeRetrievalApiRequest({
      knowledgePackId,
      query,
      filters,
      topK,
      includeMetadata,
      retrievalMode,
      requestId,
      serviceChannel: "MCP",
      executionMode: "PUBLIC",
    });

    if (!result.ok) {
      if (result.code === "SERVICE_CHANNEL_DISABLED" || result.code === "SERVICE_ENDED") {
        await recordPublicApiUsage(context, {
          statusCode: 403,
          query: safeQuery,
          metadata: { reason: result.code, packId: context.packId, serviceChannel: "MCP" },
        });
        return apiErrorResponse(requestId, result.code, result.message, 403);
      }
      if (result.code === "PACK_RETRIEVAL_NOT_READY") {
        await recordPublicApiUsage(context, {
          statusCode: 409,
          query: safeQuery,
          metadata: { reason: "PACK_RETRIEVAL_NOT_READY", packId: context.packId },
        });
        return apiErrorResponse(
          requestId,
          "PACK_RETRIEVAL_NOT_READY",
          "이 지식팩은 아직 Retrieval API를 지원하지 않습니다.",
          409,
        );
      }
      if (result.code === "SEARCH_RUNTIME_UNAVAILABLE" || result.code === "SEARCH_GENERATION_NOT_READY") {
        const httpStatus = result.httpStatus ?? 503;
        await recordPublicApiUsage(context, {
          statusCode: httpStatus,
          query: safeQuery,
          metadata: { reason: result.code, packId: context.packId },
        });
        return apiErrorResponse(requestId, result.code, result.message, httpStatus);
      }
      await recordPublicApiUsage(context, {
        statusCode: 404,
        query: safeQuery,
        metadata: { reason: "PACK_NOT_FOUND", packId: context.packId },
      });
      return apiErrorResponse(requestId, "PACK_NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
    }

    await recordPublicApiUsage(context, {
      statusCode: 200,
      query: safeQuery,
      metadata: {
        chunkCount: result.data.usage.contextCount,
        serviceChannel: "MCP",
        topK,
      },
    });

    return NextResponse.json(result.data);
  } catch (error) {
    logSafeRouteError({
      scope: "mcp-retrieval",
      method: "POST",
      path: "/api/v1/mcp/retrieval/query",
      requestId,
      error,
    });
    await recordPublicApiUsage(context, {
      statusCode: 500,
      metadata: { error: "INTERNAL_SERVER_ERROR", serviceChannel: "MCP" },
    });
    return internalServerErrorResponse(requestId);
  }
}
