import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOriginAllowed, parseAllowedOrigins } from "../../mcp-server/cors.ts";
import { startHttpServer, type StartedMcpHttpServer } from "../../mcp-server/http-server.ts";
import type { McpServerConfig } from "../../mcp-server/config.ts";

function testConfig(overrides?: Partial<McpServerConfig>): McpServerConfig {
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

async function withServer(
  config: McpServerConfig,
  run: (started: StartedMcpHttpServer) => Promise<void>,
) {
  const started = await startHttpServer(config);
  try {
    await run(started);
  } finally {
    await started.close();
  }
}

describe("mcp http transport", () => {
  it("parses allowed origins", () => {
    assert.deepEqual(parseAllowedOrigins(""), []);
    assert.deepEqual(parseAllowedOrigins("https://a.test, https://b.test,https://a.test"), [
      "https://a.test",
      "https://b.test",
    ]);
  });

  it("allows localhost when allowlist is empty", () => {
    assert.equal(isOriginAllowed("http://localhost:3000", []), true);
    assert.equal(isOriginAllowed("https://evil.example", []), false);
    assert.equal(isOriginAllowed(undefined, []), true);
  });

  it("honors explicit allowlist and wildcard", () => {
    assert.equal(isOriginAllowed("https://app.example", ["https://app.example"]), true);
    assert.equal(isOriginAllowed("https://other.example", ["https://app.example"]), false);
    assert.equal(isOriginAllowed("https://anything.example", ["*"]), true);
  });

  it("/health returns ok without secrets", async () => {
    await withServer(testConfig(), async (started) => {
      const response = await fetch(`http://127.0.0.1:${started.port}/health`);
      assert.equal(response.status, 200);
      const body = (await response.json()) as Record<string, unknown>;
      assert.equal(body.ok, true);
      assert.equal(body.service, "jykstore-mcp-bridge");
      assert.equal(body.transport, "http");
      assert.equal("apiKey" in body, false);
    });
  });

  it("/ready reports apiKeyConfigured without key value", async () => {
    await withServer(testConfig({ allowedPackIds: ["pack-a"] }), async (started) => {
      const response = await fetch(`http://127.0.0.1:${started.port}/ready`);
      assert.equal(response.status, 200);
      const body = (await response.json()) as Record<string, unknown>;
      assert.equal(body.ok, true);
      assert.equal(body.apiKeyConfigured, true);
      assert.equal(body.allowedPackIdsConfigured, true);
      assert.equal(body.baseUrl, "http://localhost:3004");
      const serialized = JSON.stringify(body);
      assert.equal(serialized.includes("test-key-12345678"), false);
    });
  });

  it("sets CORS for allowed origin and blocks others", async () => {
    await withServer(
      testConfig({ allowedOrigins: ["https://allowed.example"] }),
      async (started) => {
        const ok = await fetch(`http://127.0.0.1:${started.port}/health`, {
          headers: { Origin: "https://allowed.example" },
        });
        assert.equal(ok.status, 200);
        assert.equal(ok.headers.get("access-control-allow-origin"), "https://allowed.example");

        const blocked = await fetch(`http://127.0.0.1:${started.port}/health`, {
          headers: { Origin: "https://blocked.example" },
        });
        assert.equal(blocked.status, 403);
        const body = (await blocked.json()) as { code?: string };
        assert.equal(body.code, "JYKSTORE_MCP_ORIGIN_NOT_ALLOWED");
      },
    );
  });

  it("close does not throw", async () => {
    const started = await startHttpServer(testConfig());
    await started.close();
    await started.close();
  });
});
