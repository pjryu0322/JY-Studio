import {
  OPENAPI_SCHEMA_VERSION,
  OPENAPI_SPEC_VERSION,
  type OpenApiBuildOptions,
  type OpenApiDocument,
} from "@/lib/openapi-dto";

const DEFAULT_EXAMPLE_PACK_ID = "easy-auth";

const COMMON_DESCRIPTION =
  "Public API schema for external AI agents, GPT Actions, Gemini function calling wrappers, Cursor/MCP wrappers, and integration clients. JYKStore returns verified knowledge pack context and exports; it does not generate answers. Only PUBLISHED or VERIFIED knowledge packs are returned; other packs are treated as PACK_NOT_FOUND (404). All operations use a Bearer API Key and no API key is ever included in this schema.";

function bearerSecurity() {
  return [{ BearerAuth: [] as string[] }];
}

function errorResponse(description: string) {
  return {
    description,
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorResponse" },
      },
    },
  };
}

function commonErrorResponses() {
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

function knowledgePackIdQueryParam(examplePackId: string) {
  return {
    name: "knowledgePackId",
    in: "query",
    required: true,
    description: "Target knowledge pack id. Only PUBLISHED or VERIFIED packs are returned.",
    schema: { type: "string" },
    example: examplePackId,
  };
}

function jsonResponse(ref: string, description: string) {
  return {
    description,
    content: { "application/json": { schema: { $ref: ref } } },
  };
}

function buildComponents() {
  return {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JYKStore API Key",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: { type: "array", items: { type: "string" } },
            },
            required: ["code", "message"],
          },
          usage: {
            type: "object",
            properties: { requestId: { type: "string" } },
          },
        },
        required: ["error"],
      },
      RetrievalRequest: {
        type: "object",
        required: ["knowledgePackId"],
        properties: {
          knowledgePackId: { type: "string" },
          query: { type: "string" },
          filters: { type: "object", additionalProperties: true },
          topK: { type: "integer", minimum: 1, maximum: 20 },
          includeMetadata: { type: "boolean" },
          retrievalMode: { type: "string", enum: ["keyword", "hybrid"] },
        },
      },
      RetrievalContext: {
        type: "object",
        properties: {
          chunkId: { type: "string" },
          knowledgePackId: { type: "string" },
          title: { type: "string" },
          content: { type: "string" },
          score: { type: "number" },
          matchReasons: { type: "array", items: { type: "string" } },
          metadata: { type: "object", additionalProperties: true, nullable: true },
          scoreDetail: {
            type: "object",
            properties: {
              keywordScore: { type: "number" },
              metadataScore: { type: "number" },
              vectorScore: { type: "number" },
              vectorSimilarity: { type: "number" },
            },
          },
          references: {
            type: "array",
            items: { $ref: "#/components/schemas/Reference" },
          },
        },
      },
      RetrievalResponse: {
        type: "object",
        properties: {
          contexts: { type: "array", items: { $ref: "#/components/schemas/RetrievalContext" } },
          usage: {
            type: "object",
            properties: {
              requestId: { type: "string" },
              contextCount: { type: "integer" },
              topK: { type: "integer" },
              usedFilters: { type: "object", additionalProperties: true },
              retrievalMode: { type: "string", enum: ["keyword", "hybrid"] },
              embeddingProvider: { type: "string" },
              embeddingModel: { type: "string" },
              scannedCandidateCount: { type: "integer" },
              filteredCandidateCount: { type: "integer" },
              candidateCollectionMode: {
                type: "string",
                enum: ["default-page", "metadata-filter", "query-scan"],
              },
            },
          },
        },
      },
      GraphQueryRequest: {
        type: "object",
        required: ["knowledgePackId"],
        properties: {
          knowledgePackId: { type: "string" },
          query: { type: "string" },
          nodeTypes: { type: "array", items: { type: "string" } },
          edgeTypes: { type: "array", items: { type: "string" } },
          limit: { type: "integer", minimum: 1, maximum: 200 },
          includeEdges: { type: "boolean" },
        },
      },
      GraphNode: {
        type: "object",
        properties: {
          id: { type: "string" },
          packId: { type: "string" },
          versionId: { type: "string", nullable: true },
          nodeType: { type: "string" },
          externalId: { type: "string" },
          label: { type: "string" },
          summary: { type: "string", nullable: true },
          metadata: { type: "object", additionalProperties: true, nullable: true },
        },
      },
      GraphEdge: {
        type: "object",
        properties: {
          id: { type: "string" },
          packId: { type: "string" },
          versionId: { type: "string", nullable: true },
          edgeType: { type: "string" },
          fromNodeId: { type: "string" },
          toNodeId: { type: "string" },
          weight: { type: "number" },
          metadata: { type: "object", additionalProperties: true, nullable: true },
        },
      },
      GraphQueryResponse: {
        type: "object",
        properties: {
          nodes: { type: "array", items: { $ref: "#/components/schemas/GraphNode" } },
          edges: { type: "array", items: { $ref: "#/components/schemas/GraphEdge" } },
          usage: {
            type: "object",
            properties: {
              requestId: { type: "string" },
              nodeCount: { type: "integer" },
              edgeCount: { type: "integer" },
              limit: { type: "integer" },
            },
          },
        },
      },
      KnowledgeGraphSummary: {
        type: "object",
        properties: {
          packId: { type: "string" },
          versionId: { type: "string", nullable: true },
          nodeCount: { type: "integer" },
          edgeCount: { type: "integer" },
          nodeTypeCounts: { type: "object", additionalProperties: { type: "integer" } },
          edgeTypeCounts: { type: "object", additionalProperties: { type: "integer" } },
        },
      },
      Reference: {
        type: "object",
        properties: {
          type: { type: "string" },
          title: { type: "string" },
        },
      },
      PackageExportManifest: {
        type: "object",
        properties: {
          name: { type: "string" },
          knowledgePackId: { type: "string" },
          version: { type: "string", nullable: true },
          capabilities: { type: "array", items: { type: "string" } },
        },
      },
      PackageExportPack: {
        type: "object",
        properties: {
          packId: { type: "string" },
          name: { type: "string" },
          category: { type: "string" },
          providerName: { type: "string" },
          status: { type: "string" },
          shortDescription: { type: "string" },
          description: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
      },
      PackageExportVersion: {
        type: "object",
        nullable: true,
        properties: {
          id: { type: "string" },
          version: { type: "string" },
          overview: { type: "string" },
          versionSummary: { type: "string" },
          features: { type: "array", items: { type: "string" } },
          includedKnowledge: { type: "array", items: { type: "string" } },
          supportedEnvironments: { type: "array", items: { type: "string" } },
          targetUsers: { type: "array", items: { type: "string" } },
          useCases: { type: "array", items: { type: "string" } },
        },
      },
      PackageExportSourceDocument: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          sourceType: { type: "string" },
          sourceUrl: { type: "string", nullable: true },
        },
      },
      PackageExportChunk: {
        type: "object",
        properties: {
          id: { type: "string" },
          chunkType: { type: "string" },
          title: { type: "string" },
          content: { type: "string" },
          section: { type: "string", nullable: true },
          tags: { type: "array", items: { type: "string" } },
          metadata: { type: "object", additionalProperties: true, nullable: true },
          sortOrder: { type: "integer" },
          sourceDocumentId: { type: "string", nullable: true },
        },
      },
      PackageExportGraph: {
        type: "object",
        properties: {
          summary: { $ref: "#/components/schemas/KnowledgeGraphSummary" },
          nodes: { type: "array", items: { $ref: "#/components/schemas/GraphNode" } },
          edges: { type: "array", items: { $ref: "#/components/schemas/GraphEdge" } },
        },
      },
      PackageExportEmbedding: {
        type: "object",
        properties: {
          provider: { type: "string" },
          model: { type: "string" },
          dimension: { type: "integer" },
          includeVectors: { type: "boolean" },
        },
      },
      PackageExport: {
        type: "object",
        properties: {
          exportType: { type: "string", enum: ["JYKSTORE_PACKAGE_JSON"] },
          exportVersion: { type: "string" },
          generatedAt: { type: "string" },
          manifest: { $ref: "#/components/schemas/PackageExportManifest" },
          pack: { $ref: "#/components/schemas/PackageExportPack" },
          version: { $ref: "#/components/schemas/PackageExportVersion" },
          sourceDocuments: {
            type: "array",
            items: { $ref: "#/components/schemas/PackageExportSourceDocument" },
          },
          chunks: { type: "array", items: { $ref: "#/components/schemas/PackageExportChunk" } },
          graph: { $ref: "#/components/schemas/PackageExportGraph" },
          embedding: { $ref: "#/components/schemas/PackageExportEmbedding" },
        },
      },
      GraphExport: {
        type: "object",
        properties: {
          exportType: { type: "string", enum: ["JYKSTORE_GRAPH_JSON"] },
          exportVersion: { type: "string" },
          generatedAt: { type: "string" },
          knowledgePackId: { type: "string" },
          summary: { $ref: "#/components/schemas/KnowledgeGraphSummary" },
          nodes: { type: "array", items: { $ref: "#/components/schemas/GraphNode" } },
          edges: { type: "array", items: { $ref: "#/components/schemas/GraphEdge" } },
        },
      },
      RagJsonlLine: {
        type: "object",
        description: "One active chunk record. RAG JSONL response is one such object per line.",
        properties: {
          id: { type: "string" },
          knowledgePackId: { type: "string" },
          version: { type: "string" },
          title: { type: "string" },
          text: { type: "string" },
          metadata: { type: "object", additionalProperties: true },
          references: { type: "array", items: { $ref: "#/components/schemas/Reference" } },
        },
      },
      McpReadyManifestTool: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          method: { type: "string" },
          path: { type: "string" },
          auth: { type: "string" },
        },
      },
      McpReadyManifestResource: {
        type: "object",
        properties: {
          name: { type: "string" },
          path: { type: "string" },
          auth: { type: "string" },
        },
      },
      McpReadyManifest: {
        type: "object",
        properties: {
          manifestType: { type: "string", enum: ["JYKSTORE_MCP_READY_MANIFEST"] },
          manifestVersion: { type: "string" },
          knowledgePackId: { type: "string" },
          baseUrlPlaceholder: { type: "string" },
          note: { type: "string" },
          tools: { type: "array", items: { $ref: "#/components/schemas/McpReadyManifestTool" } },
          resources: {
            type: "array",
            items: { $ref: "#/components/schemas/McpReadyManifestResource" },
          },
        },
      },
    },
  };
}

function buildPaths(examplePackId: string, includeDiscovery: boolean) {
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
              example: {
                knowledgePackId: examplePackId,
                query: "callback",
                filters: { programmingLanguage: "Java" },
                topK: 8,
                includeMetadata: true,
                retrievalMode: "hybrid",
              },
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
              example: {
                knowledgePackId: examplePackId,
                query: "callback",
                nodeTypes: ["CHUNK", "METADATA_VALUE"],
                limit: 50,
                includeEdges: true,
              },
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

/**
 * JYKStore Public API의 OpenAPI 3.1 schema를 생성한다.
 * options.packId가 있으면 pack-specific(title/description/example) schema를 생성한다.
 * schema에는 실제 API Key 값을 절대 포함하지 않는다(dummy만 사용).
 */
export function buildOpenApiSchema(options: OpenApiBuildOptions = {}): OpenApiDocument {
  const examplePackId = options.packId ?? DEFAULT_EXAMPLE_PACK_ID;

  const title = options.packId
    ? `JYKStore ${options.packId} Knowledge Pack API`
    : "JYKStore Public API";

  const description = options.packId
    ? options.packDescription?.trim() ||
      `Public API schema for the "${options.packName ?? options.packId}" JYKStore knowledge pack. JYKStore returns verified knowledge pack context and exports; it does not generate answers.`
    : COMMON_DESCRIPTION;

  // 공통 schema에는 discovery endpoint(/api/v1/openapi.json)를 포함한다.
  const includeDiscovery = !options.packId;

  return {
    openapi: OPENAPI_SPEC_VERSION,
    info: {
      title,
      version: OPENAPI_SCHEMA_VERSION,
      description,
    },
    servers: [
      { url: "https://your-jykstore.example.com", description: "Production JYKStore origin" },
      { url: "http://localhost:3004", description: "Local development" },
    ],
    security: bearerSecurity(),
    paths: buildPaths(examplePackId, includeDiscovery),
    components: buildComponents(),
  };
}
