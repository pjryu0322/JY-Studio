import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseGraphToolInput,
  parseMetadataFilters,
  parseRetrievalToolInput,
  parseTopK,
} from "../../mcp-server/schemas.ts";
import { assertPackAllowed } from "../../mcp-server/config.ts";
import { McpBridgeError } from "../../mcp-server/errors.ts";
import { handleMcpToolCall } from "../../mcp-server/tool-handlers.ts";
import { JYKStoreClient } from "../../mcp-server/jykstore-client.ts";

describe("mcp tools validation", () => {
  it("retrieval input requires pack and query", () => {
    assert.throws(
      () => parseRetrievalToolInput({}),
      (error: unknown) =>
        error instanceof McpBridgeError && error.code === "JYKSTORE_MCP_INVALID_INPUT",
    );
  });

  it("applies topK default and max", () => {
    assert.equal(parseTopK(undefined), 5);
    assert.throws(
      () => parseTopK(21),
      (error: unknown) =>
        error instanceof McpBridgeError && error.code === "JYKSTORE_MCP_INVALID_INPUT",
    );
  });

  it("defaults retrievalMode to hybrid", () => {
    const parsed = parseRetrievalToolInput({
      knowledgePackId: "pack-1",
      query: "auth",
    });
    assert.equal(parsed.retrievalMode, "hybrid");
    assert.equal(parsed.topK, 5);
  });

  it("applies graph limit default and max", () => {
    const parsed = parseGraphToolInput({ knowledgePackId: "pack-1" });
    assert.equal(parsed.limit, 50);
    assert.throws(
      () => parseGraphToolInput({ knowledgePackId: "pack-1", limit: 201 }),
      (error: unknown) =>
        error instanceof McpBridgeError && error.code === "JYKSTORE_MCP_INVALID_INPUT",
    );
  });

  it("rejects nested metadataFilters objects", () => {
    assert.throws(
      () => parseMetadataFilters({ nested: { a: 1 } }),
      (error: unknown) =>
        error instanceof McpBridgeError && error.code === "JYKSTORE_MCP_INVALID_INPUT",
    );
  });

  it("blocks tool calls for non-allowed packs", async () => {
    const client = new JYKStoreClient({
      baseUrl: "http://localhost:3004",
      apiKey: "test-key",
      fetchImpl: (async () => {
        throw new Error("should not fetch");
      }) as typeof fetch,
    });
    const result = await handleMcpToolCall({
      name: "jykstore_retrieval_query",
      args: { knowledgePackId: "blocked", query: "q" },
      client,
      allowedPackIds: ["allowed-only"],
    });
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /JYKSTORE_MCP_PACK_NOT_ALLOWED/);
  });

  it("assertPackAllowed helper matches policy", () => {
    assert.doesNotThrow(() => assertPackAllowed("p1", []));
  });
});
