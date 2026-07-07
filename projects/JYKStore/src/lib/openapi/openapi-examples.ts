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
      "Invalid request. code: INVALID_RETRIEVAL_REQUEST / INVALID_GRAPH_QUERY_REQUEST / INVALID_EXPORT_REQUEST",
    ),
    "401": errorResponse("Unauthorized. code: UNAUTHORIZED"),
    "403": errorResponse("Forbidden. code: FORBIDDEN"),
    "404": errorResponse("Knowledge pack not found or not public. code: PACK_NOT_FOUND"),
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
