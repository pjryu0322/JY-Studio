import {
  commonErrorResponses,
  graphQueryRequestExample,
  jsonResponse,
  knowledgePackIdQueryParam,
  retrievalRequestExample,
} from "./openapi-examples";
import { bearerSecurity } from "./openapi-security";

export function buildPaths(examplePackId: string, includeDiscovery: boolean) {
  const paths: Record<string, unknown> = {
    "/api/v1/retrieval/query": {
      post: {
        operationId: "queryKnowledgePackContext",
        summary: "Query JYKStore knowledge pack contexts",
        description:
          "Return ranked context candidates from a JYKStore knowledge pack. JYKStore returns context only and does not generate answers.",
        security: bearerSecurity(),
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RetrievalRequest" },
              example: retrievalRequestExample(examplePackId),
            },
          },
        },
        responses: {
          "200": jsonResponse("#/components/schemas/RetrievalResponse", "Ranked context candidates."),
          ...commonErrorResponses(),
        },
      },
    },
    "/api/v1/graph/query": {
      post: {
        operationId: "queryKnowledgePackGraph",
        summary: "Query JYKStore knowledge graph nodes and edges",
        description:
          "Return graph nodes and edges from a JYKStore knowledge pack. Deterministic graph, no traversal or answer generation.",
        security: bearerSecurity(),
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GraphQueryRequest" },
              example: graphQueryRequestExample(examplePackId),
            },
          },
        },
        responses: {
          "200": jsonResponse("#/components/schemas/GraphQueryResponse", "Graph nodes and edges."),
          ...commonErrorResponses(),
        },
      },
    },
    "/api/v1/exports/package": {
      get: {
        operationId: "exportKnowledgePackPackage",
        summary: "Export a JYKStore knowledge pack as package JSON",
        security: bearerSecurity(),
        parameters: [knowledgePackIdQueryParam(examplePackId)],
        responses: {
          "200": jsonResponse("#/components/schemas/PackageExport", "JYKSTORE_PACKAGE_JSON export."),
          ...commonErrorResponses(),
        },
      },
    },
    "/api/v1/exports/rag-jsonl": {
      get: {
        operationId: "exportKnowledgePackRagJsonl",
        summary: "Export active chunks as RAG JSONL (line-delimited JSON)",
        description:
          "Line-delimited JSON. Each line is one active chunk record with id, knowledgePackId, version, title, text, metadata, references. Each line conforms to RagJsonlLine.",
        security: bearerSecurity(),
        parameters: [knowledgePackIdQueryParam(examplePackId)],
        responses: {
          "200": {
            description:
              "Line-delimited JSON. One active chunk per line; each line conforms to RagJsonlLine.",
            content: { "application/x-ndjson": { schema: { type: "string" } } },
          },
          ...commonErrorResponses(),
        },
      },
    },
    "/api/v1/exports/graph": {
      get: {
        operationId: "exportKnowledgePackGraph",
        summary: "Export the deterministic knowledge graph as JSON",
        security: bearerSecurity(),
        parameters: [knowledgePackIdQueryParam(examplePackId)],
        responses: {
          "200": jsonResponse("#/components/schemas/GraphExport", "JYKSTORE_GRAPH_JSON export."),
          ...commonErrorResponses(),
        },
      },
    },
    "/api/v1/exports/mcp-manifest": {
      get: {
        operationId: "exportKnowledgePackMcpManifest",
        summary: "Export an MCP-ready manifest (not a running MCP server)",
        security: bearerSecurity(),
        parameters: [knowledgePackIdQueryParam(examplePackId)],
        responses: {
          "200": jsonResponse(
            "#/components/schemas/McpReadyManifest",
            "JYKSTORE_MCP_READY_MANIFEST. Contract for MCP wrappers to call JYKStore Public API. Not a running MCP server and no API key included.",
          ),
          ...commonErrorResponses(),
        },
      },
    },
    "/api/v1/exports/openapi": {
      get: {
        operationId: "exportKnowledgePackOpenApi",
        summary: "Export a pack-specific OpenAPI 3.1 schema",
        description: "OpenAPI 3.1 document for the given JYKStore knowledge pack. Does not include API keys.",
        security: bearerSecurity(),
        parameters: [knowledgePackIdQueryParam(examplePackId)],
        responses: {
          "200": {
            description: "OpenAPI 3.1 document for JYKStore Public API. Does not include API keys.",
            content: { "application/json": { schema: { type: "object", additionalProperties: true } } },
          },
          ...commonErrorResponses(),
        },
      },
    },
  };

  if (includeDiscovery) {
    paths["/api/v1/openapi.json"] = {
      get: {
        operationId: "getJYKStoreOpenApiSchema",
        summary: "Get the common JYKStore Public API OpenAPI schema",
        description:
          "Schema discovery endpoint. No authentication required. OpenAPI 3.1 document for JYKStore Public API. Does not include API keys.",
        responses: {
          "200": {
            description: "OpenAPI 3.1 document for JYKStore Public API. Does not include API keys.",
            content: { "application/json": { schema: { type: "object", additionalProperties: true } } },
          },
        },
      },
    };
  }

  return paths;
}
