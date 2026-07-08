import type { McpServerConfig } from "../../../mcp-server/config.ts";
import { startHttpServer, type StartedMcpHttpServer } from "../../../mcp-server/http-server.ts";
import { MCP_TOOL_NAMES } from "../../../mcp-server/tool-definitions.ts";
import {
  RESOURCE_TEMPLATES,
  STATIC_RESOURCE_LIST,
} from "../../../mcp-server/resource-handlers.ts";

export const EXPECTED_MCP_TOOL_NAMES = [...MCP_TOOL_NAMES];

export const EXPECTED_STATIC_RESOURCE_URIS = STATIC_RESOURCE_LIST.map((item) => item.uri);

export const EXPECTED_RESOURCE_TEMPLATES = RESOURCE_TEMPLATES.map((item) => item.uriTemplate);

export function createRuntimeTestConfig(
  overrides?: Partial<McpServerConfig>,
): McpServerConfig {
  return {
    baseUrl: "http://localhost:3004",
    apiKey: "test-key-12345678",
    transport: "http",
    port: 0,
    allowedPackIds: [],
    allowedOrigins: [],
    timeoutMs: 5_000,
    maxResponseBytes: 2_000_000,
    maxExportSourceBytes: 20_000_000,
    ...overrides,
  };
}

export function createMockPublicApiFetch(): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();

    if (method === "POST" && url.includes("/api/v1/retrieval/query")) {
      return new Response(
        JSON.stringify({
          contexts: [
            {
              chunkId: "chunk-1",
              title: "Auth",
              content: "Authenticate with API key",
              score: 0.9,
            },
          ],
          knowledgePackId: "pack-1",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (method === "GET" && url.includes("/api/v1/exports/rag-jsonl/chunk")) {
      return new Response(
        JSON.stringify({
          knowledgePackId: "pack-1",
          exportType: "rag-jsonl",
          offset: 0,
          limitBytes: 256000,
          nextOffset: 12,
          hasMore: false,
          byteLength: 12,
          totalBytes: 12,
          mimeType: "application/x-ndjson",
          content: '{"id":"c1"}\n',
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (method === "GET" && url.includes("/api/v1/openapi.json")) {
      return new Response(JSON.stringify({ openapi: "3.1.0", info: { title: "JYKStore" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        code: "PACK_NOT_FOUND",
        message: "Pack not found",
        requestId: "req_mock",
      }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;
}

export async function withHttpRuntimeServer(
  run: (started: StartedMcpHttpServer) => Promise<void>,
  overrides?: Partial<McpServerConfig>,
): Promise<void> {
  const started = await startHttpServer(createRuntimeTestConfig(overrides), {
    fetchImpl: createMockPublicApiFetch(),
  });
  try {
    await run(started);
  } finally {
    await started.close();
  }
}

export function assertNoSecretLeak(serialized: string, secret = "test-key-12345678"): void {
  if (serialized.includes(secret)) {
    throw new Error("API key leaked into response or logs payload");
  }
}
