import { BEARER_SECURITY_SCHEME } from "./openapi-security";

export function buildComponents() {
  return {
    securitySchemes: {
      BearerAuth: BEARER_SECURITY_SCHEME,
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
