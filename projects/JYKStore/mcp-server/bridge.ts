import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { JYKStoreClient } from "./jykstore-client.js";
import { handleResourceRead } from "./resource-handlers.js";
import {
  MAX_EXPORT_CHUNK_LIMIT_BYTES,
  MCP_RETRIEVAL_QUERY_MAX_LENGTH,
  MIN_EXPORT_CHUNK_LIMIT_BYTES,
} from "./schemas.js";
import { handleMcpToolCall } from "./tool-handlers.js";

const packIdSchema = z.string().min(1).max(100);
const metadataValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);
const chunkOffsetSchema = z.number().int().min(0).optional();
const chunkLimitBytesSchema = z
  .number()
  .int()
  .min(MIN_EXPORT_CHUNK_LIMIT_BYTES)
  .max(MAX_EXPORT_CHUNK_LIMIT_BYTES)
  .optional();

export function createBridgeServer(client: JYKStoreClient, allowedPackIds: string[]) {
  const server = new McpServer({
    name: "jykstore-mcp-bridge",
    version: "0.1.0",
  });

  server.registerTool(
    "jykstore_retrieval_query",
    {
      description:
        "Search validated context chunks from a JYKStore knowledge pack via Public Retrieval API. Returns raw JSON context, not a generated answer.",
      inputSchema: {
        knowledgePackId: packIdSchema,
        query: z.string().min(1).max(MCP_RETRIEVAL_QUERY_MAX_LENGTH),
        topK: z.number().int().min(1).max(20).optional(),
        retrievalMode: z.enum(["keyword", "hybrid"]).optional(),
        metadataFilters: z.record(z.string(), metadataValueSchema).optional(),
      },
    },
    async (args) =>
      handleMcpToolCall({
        name: "jykstore_retrieval_query",
        args,
        client,
        allowedPackIds,
      }),
  );

  server.registerTool(
    "jykstore_graph_query",
    {
      description: "Query the knowledge graph of a JYKStore knowledge pack via Public Graph API.",
      inputSchema: {
        knowledgePackId: packIdSchema,
        nodeTypes: z.array(z.string()).optional(),
        edgeTypes: z.array(z.string()).optional(),
        query: z.string().max(2000).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    async (args) =>
      handleMcpToolCall({
        name: "jykstore_graph_query",
        args,
        client,
        allowedPackIds,
      }),
  );

  const exportTools = [
    ["jykstore_export_package", "Export a full knowledge pack package JSON via Public Export API."],
    ["jykstore_export_rag_jsonl", "Export RAG JSONL lines for a knowledge pack via Public Export API."],
    ["jykstore_export_graph", "Export knowledge graph JSON for a pack via Public Export API."],
    ["jykstore_export_openapi", "Export pack-specific OpenAPI schema via Public Export API."],
    [
      "jykstore_export_mcp_manifest",
      "Export the P15 MCP-ready manifest (contract document). This runtime is the P22 bridge.",
    ],
  ] as const;

  for (const [name, description] of exportTools) {
    server.registerTool(
      name,
      {
        description,
        inputSchema: {
          knowledgePackId: packIdSchema,
        },
      },
      async (args) =>
        handleMcpToolCall({
          name,
          args,
          client,
          allowedPackIds,
        }),
    );
  }

  const chunkTools = [
    [
      "jykstore_export_package_chunk",
      "Read a byte chunk of a knowledge pack package JSON export via Public Export API.",
    ],
    [
      "jykstore_export_rag_jsonl_chunk",
      "Read a byte chunk of RAG JSONL export via Public Export API.",
    ],
    [
      "jykstore_export_graph_chunk",
      "Read a byte chunk of knowledge graph JSON export via Public Export API.",
    ],
  ] as const;

  for (const [name, description] of chunkTools) {
    server.registerTool(
      name,
      {
        description,
        inputSchema: {
          knowledgePackId: packIdSchema,
          offset: chunkOffsetSchema,
          limitBytes: chunkLimitBytesSchema,
        },
      },
      async (args) =>
        handleMcpToolCall({
          name,
          args,
          client,
          allowedPackIds,
        }),
    );
  }

  server.resource(
    "jykstore-openapi",
    "jykstore://openapi",
    {
      mimeType: "application/json",
      description: "JYKStore Public API OpenAPI schema",
    },
    async (uri) => {
      const result = await handleResourceRead({
        uri: uri.href,
        client,
        allowedPackIds,
      });
      return { contents: result.contents };
    },
  );

  const templates: Array<{ name: string; suffix: string; mimeType: string; description: string }> =
    [
      {
        name: "pack-package",
        suffix: "package",
        mimeType: "application/json",
        description: "Pack package export",
      },
      {
        name: "pack-rag-jsonl",
        suffix: "rag-jsonl",
        mimeType: "application/x-ndjson",
        description: "Pack RAG JSONL export",
      },
      {
        name: "pack-graph",
        suffix: "graph",
        mimeType: "application/json",
        description: "Pack graph export",
      },
      {
        name: "pack-openapi",
        suffix: "openapi",
        mimeType: "application/json",
        description: "Pack OpenAPI export",
      },
      {
        name: "pack-mcp-manifest",
        suffix: "mcp-manifest",
        mimeType: "application/json",
        description: "Pack MCP-ready manifest",
      },
    ];

  for (const template of templates) {
    server.resource(
      template.name,
      new ResourceTemplate(`jykstore://packs/{knowledgePackId}/${template.suffix}`, {
        list: undefined,
      }),
      {
        mimeType: template.mimeType,
        description: template.description,
      },
      async (uri) => {
        const result = await handleResourceRead({
          uri: uri.href,
          client,
          allowedPackIds,
        });
        return { contents: result.contents };
      },
    );
  }

  return server;
}
