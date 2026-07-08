import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseExportChunkToolInput,
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

  it("aligns MCP retrieval query max length with expanded Public API contract", () => {
    const okQuery = "a".repeat(2000);
    const parsed = parseRetrievalToolInput({
      knowledgePackId: "pack-1",
      query: okQuery,
    });
    assert.equal(parsed.query.length, 2000);

    assert.throws(
      () =>
        parseRetrievalToolInput({
          knowledgePackId: "pack-1",
          query: "a".repeat(2001),
        }),
      (error: unknown) =>
        error instanceof McpBridgeError && error.code === "JYKSTORE_MCP_INVALID_INPUT",
    );
  });

  it("keeps graph query max independent and allows 2000 chars", () => {
    const parsed = parseGraphToolInput({
      knowledgePackId: "pack-1",
      query: "a".repeat(2000),
    });
    assert.equal(parsed.query?.length, 2000);

    assert.throws(
      () =>
        parseGraphToolInput({
          knowledgePackId: "pack-1",
          query: "a".repeat(2001),
        }),
      (error: unknown) =>
        error instanceof McpBridgeError && error.code === "JYKSTORE_MCP_INVALID_INPUT",
    );
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

  it("export chunk input defaults offset and limitBytes", () => {
    const parsed = parseExportChunkToolInput({ knowledgePackId: "pack-1" });
    assert.equal(parsed.offset, 0);
    assert.equal(parsed.limitBytes, 256_000);
  });

  it("rejects export chunk limitBytes above max and negative offset", () => {
    assert.throws(
      () =>
        parseExportChunkToolInput({
          knowledgePackId: "pack-1",
          limitBytes: 1_000_001,
        }),
      (error: unknown) =>
        error instanceof McpBridgeError && error.code === "JYKSTORE_MCP_INVALID_INPUT",
    );
    assert.throws(
      () =>
        parseExportChunkToolInput({
          knowledgePackId: "pack-1",
          offset: -1,
        }),
      (error: unknown) =>
        error instanceof McpBridgeError && error.code === "JYKSTORE_MCP_INVALID_INPUT",
    );
  });

  it("blocks chunked export for non-allowed packs before fetch", async () => {
    const client = new JYKStoreClient({
      baseUrl: "http://localhost:3004",
      apiKey: "test-key",
      fetchImpl: (async () => {
        throw new Error("should not fetch");
      }) as typeof fetch,
    });
    const result = await handleMcpToolCall({
      name: "jykstore_export_rag_jsonl_chunk",
      args: { knowledgePackId: "blocked", offset: 0, limitBytes: 1024 },
      client,
      allowedPackIds: ["allowed-only"],
    });
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /JYKSTORE_MCP_PACK_NOT_ALLOWED/);
  });

  it("returns rag-jsonl chunk with hasMore/nextOffset/content", async () => {
    let calledUrl = "";
    const chunkPayload = {
      knowledgePackId: "pack-1",
      exportType: "rag-jsonl",
      offset: 0,
      limitBytes: 1024,
      nextOffset: 1024,
      hasMore: true,
      byteLength: 1024,
      totalBytes: 4001,
      mimeType: "application/x-ndjson",
      content: "a".repeat(1024),
    };
    const client = new JYKStoreClient({
      baseUrl: "http://localhost:3004",
      apiKey: "test-key",
      fetchImpl: (async (input) => {
        calledUrl = String(input);
        return new Response(JSON.stringify(chunkPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch,
    });
    const result = await handleMcpToolCall({
      name: "jykstore_export_rag_jsonl_chunk",
      args: { knowledgePackId: "pack-1", offset: 0, limitBytes: 1024 },
      client,
      allowedPackIds: [],
    });
    assert.ok(calledUrl.includes("/api/v1/exports/rag-jsonl/chunk"));
    assert.ok(calledUrl.includes("offset=0"));
    assert.ok(calledUrl.includes("limitBytes=1024"));
    assert.equal(result.isError, undefined);
    const payload = JSON.parse(result.content[0]!.text) as {
      hasMore: boolean;
      nextOffset: number;
      byteLength: number;
      content: string;
      exportType: string;
    };
    assert.equal(payload.exportType, "rag-jsonl");
    assert.equal(payload.hasMore, true);
    assert.equal(payload.nextOffset, 1024);
    assert.equal(payload.byteLength, 1024);
    assert.equal(payload.content.length, 1024);
  });

  it("calls package and graph chunk endpoints", async () => {
    const urls: string[] = [];
    const makePayload = (exportType: string) => ({
      knowledgePackId: "pack-1",
      exportType,
      offset: 0,
      limitBytes: 1024,
      nextOffset: 10,
      hasMore: false,
      byteLength: 10,
      totalBytes: 10,
      mimeType: "application/json",
      content: '{"ok":true}',
    });
    const client = new JYKStoreClient({
      baseUrl: "http://localhost:3004",
      apiKey: "test-key",
      fetchImpl: (async (input) => {
        urls.push(String(input));
        const url = String(input);
        const exportType = url.includes("/package/chunk")
          ? "package"
          : url.includes("/graph/chunk")
            ? "graph"
            : "rag-jsonl";
        return new Response(JSON.stringify(makePayload(exportType)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch,
    });

    await handleMcpToolCall({
      name: "jykstore_export_package_chunk",
      args: { knowledgePackId: "pack-1", offset: 0, limitBytes: 1024 },
      client,
      allowedPackIds: [],
    });
    await handleMcpToolCall({
      name: "jykstore_export_graph_chunk",
      args: { knowledgePackId: "pack-1", offset: 0, limitBytes: 1024 },
      client,
      allowedPackIds: [],
    });

    assert.ok(urls.some((u) => u.includes("/api/v1/exports/package/chunk")));
    assert.ok(urls.some((u) => u.includes("/api/v1/exports/graph/chunk")));
  });

  it("rejects chunked export when final JSON exceeds maxResponseBytes", async () => {
    // Compact API body fits; pretty-printed MCP wrapper exceeds the threshold.
    const content = "a".repeat(3_000);
    const chunkPayload = {
      knowledgePackId: "pack-1",
      exportType: "rag-jsonl" as const,
      offset: 0,
      limitBytes: 3_000,
      nextOffset: 3_000,
      hasMore: false,
      byteLength: 3_000,
      totalBytes: 3_000,
      mimeType: "application/x-ndjson",
      content,
    };
    const compactBytes = Buffer.byteLength(JSON.stringify(chunkPayload), "utf8");
    const prettyBytes = Buffer.byteLength(JSON.stringify(chunkPayload, null, 2), "utf8");
    const maxResponseBytes = Math.floor((compactBytes + prettyBytes) / 2);
    assert.ok(compactBytes < maxResponseBytes);
    assert.ok(prettyBytes > maxResponseBytes);

    const client = new JYKStoreClient({
      baseUrl: "http://localhost:3004",
      apiKey: "test-key",
      maxResponseBytes,
      fetchImpl: (async () =>
        new Response(JSON.stringify(chunkPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })) as typeof fetch,
    });
    const result = await handleMcpToolCall({
      name: "jykstore_export_rag_jsonl_chunk",
      args: { knowledgePackId: "pack-1", offset: 0, limitBytes: 3_000 },
      client,
      allowedPackIds: [],
    });
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /JYKSTORE_MCP_RESPONSE_TOO_LARGE/);
    assert.match(result.content[0]!.text, /Reduce limitBytes/);
  });
});
