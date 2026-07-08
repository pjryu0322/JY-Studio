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
import { retrieveContexts } from "@/lib/retrieval-service";
import { logSafeRouteError } from "@/lib/safe-logging";
import {
  apiErrorResponse,
  createPublicApiContext,
  internalServerErrorResponse,
  parseJsonBodySafe,
  recordPublicApiUsage,
  requireContextReadApiKey,
  requireQuota,
  validationErrorResponse,
} from "@/lib/public-api-handler";

function validationError(requestId: string, details: string[]) {
  return validationErrorResponse(
    requestId,
    "INVALID_RETRIEVAL_REQUEST",
    "Invalid retrieval request.",
    details,
  );
}

export async function POST(request: NextRequest) {
  const context = createPublicApiContext(request);
  const { requestId } = context;

  try {
    const auth = await requireContextReadApiKey(context);
    if (!auth.ok) return auth.response;

    const quota = await requireQuota(context);
    if (!quota.ok) return quota.response;

    const parsed = await parseJsonBodySafe<RetrievalRequestBody>(request);
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
    if (!queryResult.ok) {
      details.push(queryResult.error);
    }

    const topKResult = normalizeTopK(body.topK);
    if (!topKResult.ok) details.push(topKResult.error);

    const filterResult = validateAndNormalizeFilters(body.filters);
    if (!filterResult.ok) details.push(...filterResult.errors);

    if (details.length > 0) {
      await recordPublicApiUsage(context, {
        statusCode: 400,
        metadata: { reason: "INVALID_RETRIEVAL_REQUEST" },
      });
      return validationError(requestId, details);
    }

    const knowledgePackId = (body.knowledgePackId as string).trim();
    const topK = topKResult.ok ? topKResult.topK : DEFAULT_TOP_K;
    const filters = filterResult.ok ? filterResult.filters : {};
    const query = queryResult.ok ? queryResult.query : undefined;
    const safeQuery = query?.slice(0, RETRIEVAL_QUERY_MAX_LENGTH);
    const includeMetadata = body.includeMetadata === undefined ? true : Boolean(body.includeMetadata);
    // 기본값: query가 있으면 hybrid, 없으면 keyword/metadata ranking.
    const retrievalMode: RetrievalMode =
      (body.retrievalMode as RetrievalMode | undefined) ?? (query ? "hybrid" : "keyword");

    const result = await retrieveContexts({
      knowledgePackId,
      query,
      filters,
      topK,
      includeMetadata,
      retrievalMode,
      requestId,
    });

    if (!result) {
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
        chunkCount: result.usage.contextCount,
        query: safeQuery,
        topK,
        includeMetadata,
        filterKeys: Object.keys(filters),
        retrievalMode: result.usage.retrievalMode,
        embeddingProvider: result.usage.embeddingProvider,
        embeddingModel: result.usage.embeddingModel,
        scannedCandidateCount: result.usage.scannedCandidateCount,
        filteredCandidateCount: result.usage.filteredCandidateCount,
        candidateCollectionMode: result.usage.candidateCollectionMode,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    logSafeRouteError({
      scope: "retrieval",
      method: "POST",
      path: context.endpoint,
      requestId,
      error,
    });
    await recordPublicApiUsage(context, {
      statusCode: 500,
      metadata: { error: "INTERNAL_SERVER_ERROR" },
    });
    return internalServerErrorResponse(requestId);
  }
}
