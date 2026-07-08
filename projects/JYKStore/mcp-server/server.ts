import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "node:http";
import { z } from "zod";
import { loadMcpServerConfig, maskApiKey, type McpServerConfig } from "./config.js";
import { JYKStoreClient } from "./jykstore-client.js";
import { handleResourceRead } from "./resource-handlers.js";
import { handleMcpToolCall } from "./tool-handlers.js";

const packIdSchema = z.string().min(1).max(100);
const metadataValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);

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
        query: z.string().min(1).max(2000),
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

async function startStdio(config: McpServerConfig) {
  const client = new JYKStoreClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    timeoutMs: config.timeoutMs,
    maxResponseBytes: config.maxResponseBytes,
    allowedPackIds: config.allowedPackIds,
  });
  const server = createBridgeServer(client, config.allowedPackIds);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function startHttp(config: McpServerConfig) {
  const { StreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/streamableHttp.js"
  );

  const httpServer = createServer(async (req, res) => {
    if (req.method === "GET" && (req.url === "/health" || req.url?.startsWith("/health?"))) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "jykstore-mcp-bridge" }));
      return;
    }

    try {
      const client = new JYKStoreClient({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        timeoutMs: config.timeoutMs,
        maxResponseBytes: config.maxResponseBytes,
        allowedPackIds: config.allowedPackIds,
      });
      const mcp = createBridgeServer(client, config.allowedPackIds);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      res.on("close", () => {
        void transport.close();
        void mcp.close();
      });
      await mcp.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("[jykstore-mcp] HTTP request failed", error);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ code: "JYKSTORE_MCP_INTERNAL_ERROR", message: "HTTP transport error" }));
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(config.port, () => resolve());
  });
  console.error(`[jykstore-mcp] HTTP transport listening on :${config.port}`);
}

async function main() {
  const config = loadMcpServerConfig();
  console.error(
    `[jykstore-mcp] starting transport=${config.transport} baseUrl=${config.baseUrl} apiKey=${maskApiKey(config.apiKey)}`,
  );

  if (config.transport === "http") {
    await startHttp(config);
  } else {
    await startStdio(config);
  }
}

main().catch((error) => {
  console.error("[jykstore-mcp] failed to start", error);
  process.exit(1);
});
