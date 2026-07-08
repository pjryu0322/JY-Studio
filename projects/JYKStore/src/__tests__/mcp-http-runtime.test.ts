import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  assertNoSecretLeak,
  EXPECTED_MCP_TOOL_NAMES,
  withHttpRuntimeServer,
} from "./helpers/mcp-runtime-test-utils.ts";

async function withMcpHttpClient<T>(
  port: number,
  run: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ name: "jykstore-runtime-test", version: "0.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/`));
  await client.connect(transport);
  try {
    return await run(client);
  } finally {
    await client.close();
    await transport.close();
  }
}

describe("mcp http runtime integration", () => {
  it("serves health/ready without leaking API key", async () => {
    await withHttpRuntimeServer(async (started) => {
      const health = await fetch(`http://127.0.0.1:${started.port}/health`);
      assert.equal(health.status, 200);
      const healthBody = (await health.json()) as { ok?: boolean; transport?: string };
      assert.equal(healthBody.ok, true);
      assert.equal(healthBody.transport, "http");
      assertNoSecretLeak(JSON.stringify(healthBody));

      const ready = await fetch(`http://127.0.0.1:${started.port}/ready`);
      assert.equal(ready.status, 200);
      const readyBody = (await ready.json()) as {
        ok?: boolean;
        apiKeyConfigured?: boolean;
      };
      assert.equal(readyBody.ok, true);
      assert.equal(readyBody.apiKeyConfigured, true);
      assertNoSecretLeak(JSON.stringify(readyBody));
    });
  });

  it("lists expected tools via JSON-RPC MCP client", async () => {
    await withHttpRuntimeServer(async (started) => {
      await withMcpHttpClient(started.port, async (client) => {
        const listed = await client.listTools();
        const names = listed.tools.map((tool) => tool.name).sort();
        assert.deepEqual(names, [...EXPECTED_MCP_TOOL_NAMES].sort());
        assertNoSecretLeak(JSON.stringify(listed));

        const resources = await client.listResources();
        assert.ok(resources.resources.some((item) => item.uri === "jykstore://openapi"));
        assertNoSecretLeak(JSON.stringify(resources));
      });
    });
  });

  it("calls jykstore_retrieval_query through MCP HTTP", async () => {
    await withHttpRuntimeServer(async (started) => {
      await withMcpHttpClient(started.port, async (client) => {
        const result = await client.callTool({
          name: "jykstore_retrieval_query",
          arguments: {
            knowledgePackId: "pack-1",
            query: "auth",
          },
        });
        assert.equal(result.isError, undefined);
        const text = JSON.stringify(result);
        assert.match(text, /chunk-1|Authenticate with API key|contexts/);
        assertNoSecretLeak(text);
      });
    });
  });

  it("calls jykstore_export_rag_jsonl_chunk through MCP HTTP", async () => {
    await withHttpRuntimeServer(async (started) => {
      await withMcpHttpClient(started.port, async (client) => {
        const result = await client.callTool({
          name: "jykstore_export_rag_jsonl_chunk",
          arguments: {
            knowledgePackId: "pack-1",
            offset: 0,
            limitBytes: 256000,
          },
        });
        assert.equal(result.isError, undefined);
        const payloadText =
          Array.isArray(result.content) && result.content[0] && "text" in result.content[0]
            ? String(result.content[0].text)
            : JSON.stringify(result);
        const payload = JSON.parse(payloadText) as {
          exportType?: string;
          hasMore?: boolean;
          content?: string;
        };
        assert.equal(payload.exportType, "rag-jsonl");
        assert.equal(payload.hasMore, false);
        assert.ok(typeof payload.content === "string");
        assertNoSecretLeak(payloadText);
      });
    });
  });

  it("returns a safe error for unknown tool without crashing", async () => {
    await withHttpRuntimeServer(async (started) => {
      await withMcpHttpClient(started.port, async (client) => {
        try {
          const result = await client.callTool({
            name: "jykstore_does_not_exist",
            arguments: {},
          });
          assert.equal(result.isError, true);
          assertNoSecretLeak(JSON.stringify(result));
        } catch (error) {
          const text = error instanceof Error ? error.message : String(error);
          assertNoSecretLeak(text);
          assert.match(text, /not found|unknown|Invalid|error/i);
        }

        const health = await fetch(`http://127.0.0.1:${started.port}/health`);
        assert.equal(health.status, 200);
      });
    });
  });

  it("rejects invalid JSON on MCP endpoint without crashing server", async () => {
    await withHttpRuntimeServer(async (started) => {
      const response = await fetch(`http://127.0.0.1:${started.port}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: "{not-json",
      });
      assert.ok(response.status >= 400);
      const text = await response.text();
      assertNoSecretLeak(text);

      const health = await fetch(`http://127.0.0.1:${started.port}/health`);
      assert.equal(health.status, 200);
    });
  });
});
