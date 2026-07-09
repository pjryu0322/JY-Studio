import { NextRequest, NextResponse } from "next/server";
import {
  GRAPH_QUERY_DEFAULT_LIMIT,
  GRAPH_QUERY_MAX_LIMIT,
  GRAPH_QUERY_MIN_LIMIT,
  type KnowledgeGraphQueryRequestBody,
} from "@/lib/knowledge-graph-dto";
import { queryKnowledgeGraph } from "@/lib/knowledge-graph-service";
import {
  apiErrorResponse,
  parseJsonBodySafe,
  recordPublicApiUsage,
  validationErrorResponse,
} from "@/lib/public-api-handler";
import { withPublicApiGateway } from "@/lib/public-api-route";

const QUERY_MAX_LENGTH = 200;

function validationError(requestId: string, details: string[]) {
  return validationErrorResponse(
    requestId,
    "INVALID_GRAPH_QUERY_REQUEST",
    "Invalid graph query request.",
    details,
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export async function POST(request: NextRequest) {
  return withPublicApiGateway({
    request,
    scope: "graph",
    handler: async (context) => {
      const { requestId } = context;

      const parsed = await parseJsonBodySafe<KnowledgeGraphQueryRequestBody>(context.request);
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
        await recordPublicApiUsage(context, {
          statusCode: 400,
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
          query: safeQuery,
          nodeCount: result.usage.nodeCount,
          edgeCount: result.usage.edgeCount,
          nodeTypes,
          edgeTypes,
          limit,
        },
      });

      return NextResponse.json(result);
    },
  });
}
