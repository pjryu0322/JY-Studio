// request examples / query parameter / 공통 response description helper.
// 실제 API Key 원문이나 Authorization header 예시는 schema에 포함하지 않는다.

export function errorResponse(description: string) {
  return {
    description,
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorResponse" },
      },
    },
  };
}

export function commonErrorResponses() {
  return {
    "400": errorResponse(
      "Invalid request. code: INVALID_RETRIEVAL_REQUEST / INVALID_GRAPH_QUERY_REQUEST / INVALID_EXPORT_REQUEST / INVALID_EXPORT_CHUNK_REQUEST",
    ),
    "401": errorResponse("Unauthorized. code: UNAUTHORIZED"),
    "403": errorResponse(
      "Forbidden. code: FORBIDDEN / API_KEY_REVOKED / API_KEY_EXPIRED / INSUFFICIENT_SCOPE",
    ),
    "404": errorResponse("Knowledge pack not found or not public. code: PACK_NOT_FOUND"),
    "429": errorResponse(
      "Quota exceeded for API Key clientId tenant. code: QUOTA_EXCEEDED (retryAfterSeconds)",
    ),
    "500": errorResponse("Internal server error. code: INTERNAL_SERVER_ERROR"),
  };
}

export function jsonResponse(ref: string, description: string) {
  return {
    description,
    content: { "application/json": { schema: { $ref: ref } } },
  };
}

export function knowledgePackIdQueryParam(examplePackId: string) {
  return {
    name: "knowledgePackId",
    in: "query",
    required: true,
    description: "Target knowledge pack id. Only PUBLISHED or VERIFIED packs are returned.",
    schema: { type: "string" },
    example: examplePackId,
  };
}

export function exportChunkQueryParams(examplePackId: string) {
  return [
    knowledgePackIdQueryParam(examplePackId),
    {
      name: "offset",
      in: "query",
      required: false,
      description: "Byte offset into the full export (default 0).",
      schema: { type: "integer", minimum: 0, default: 0 },
      example: 0,
    },
    {
      name: "limitBytes",
      in: "query",
      required: false,
      description: "Max bytes to return in this chunk (default 256000, max 1000000).",
      schema: {
        type: "integer",
        minimum: 1024,
        maximum: 1_000_000,
        default: 256_000,
      },
      example: 256_000,
    },
  ];
}

export function retrievalRequestExample(examplePackId: string) {
  return {
    knowledgePackId: examplePackId,
    query: "callback",
    filters: { programmingLanguage: "Java" },
    topK: 8,
    includeMetadata: true,
    retrievalMode: "hybrid",
  };
}

export function graphQueryRequestExample(examplePackId: string) {
  return {
    knowledgePackId: examplePackId,
    query: "callback",
    nodeTypes: ["CHUNK", "METADATA_VALUE"],
    limit: 50,
    includeEdges: true,
  };
}
