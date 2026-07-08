import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseResourceUri, resourceMimeType } from "../../mcp-server/schemas.ts";
import { handleResourceRead } from "../../mcp-server/resource-handlers.ts";
import { JYKStoreClient } from "../../mcp-server/jykstore-client.ts";
import { McpBridgeError } from "../../mcp-server/errors.ts";

describe("mcp resources", () => {
  it("parses pack package resource", () => {
    const parsed = parseResourceUri("jykstore://packs/my-pack/package");
    assert.deepEqual(parsed, { kind: "package", knowledgePackId: "my-pack" });
    assert.equal(resourceMimeType("package"), "application/json");
  });

  it("parses rag-jsonl resource", () => {
    const parsed = parseResourceUri("jykstore://packs/my-pack/rag-jsonl");
    assert.equal(parsed.kind, "rag-jsonl");
    assert.equal(resourceMimeType("rag-jsonl"), "application/x-ndjson");
  });

  it("parses chunk query on resource URI", () => {
    const parsed = parseResourceUri(
      "jykstore://packs/my-pack/rag-jsonl?offset=0&limitBytes=256000",
    );
    assert.equal(parsed.kind, "rag-jsonl");
    if (parsed.kind === "global-openapi") throw new Error("unexpected");
    assert.deepEqual(parsed.chunk, { offset: 0, limitBytes: 256000 });
  });

  it("parses openapi resources", () => {
    assert.deepEqual(parseResourceUri("jykstore://openapi"), { kind: "global-openapi" });
    assert.deepEqual(parseResourceUri("jykstore://packs/p1/openapi"), {
      kind: "openapi",
      knowledgePackId: "p1",
    });
  });

  it("rejects unknown resource", () => {
    assert.throws(
      () => parseResourceUri("jykstore://unknown"),
      (error: unknown) =>
        error instanceof McpBridgeError && error.code === "JYKSTORE_MCP_RESOURCE_NOT_FOUND",
    );
  });

  it("applies pack allowlist on resource read", async () => {
    const client = new JYKStoreClient({
      baseUrl: "http://localhost:3004",
      apiKey: "test-key",
      fetchImpl: (async () => {
        throw new Error("should not fetch");
      }) as typeof fetch,
    });
    const result = await handleResourceRead({
      uri: "jykstore://packs/blocked/package",
      client,
      allowedPackIds: ["allowed"],
    });
    assert.equal(result.isError, true);
    assert.match(result.contents[0]!.text, /JYKSTORE_MCP_PACK_NOT_ALLOWED/);
  });

  it("rejects chunked resource when final JSON exceeds maxResponseBytes", async () => {
    let calledUrl = "";
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
      fetchImpl: (async (input) => {
        calledUrl = String(input);
        return new Response(JSON.stringify(chunkPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch,
    });
    const result = await handleResourceRead({
      uri: "jykstore://packs/pack-1/rag-jsonl?offset=0&limitBytes=3000",
      client,
      allowedPackIds: [],
    });
    assert.ok(calledUrl.includes("/api/v1/exports/rag-jsonl/chunk"));
    assert.equal(result.isError, true);
    assert.match(result.contents[0]!.text, /JYKSTORE_MCP_RESPONSE_TOO_LARGE/);
    assert.match(result.contents[0]!.text, /Reduce limitBytes/);
  });

  it("resource chunk URI calls Public API chunk endpoint", async () => {
    let calledUrl = "";
    const chunkPayload = {
      knowledgePackId: "pack-1",
      exportType: "rag-jsonl",
      offset: 0,
      limitBytes: 256000,
      nextOffset: 10,
      hasMore: false,
      byteLength: 10,
      totalBytes: 10,
      mimeType: "application/x-ndjson",
      content: "abcdefghij",
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
    const result = await handleResourceRead({
      uri: "jykstore://packs/pack-1/rag-jsonl?offset=0&limitBytes=256000",
      client,
      allowedPackIds: [],
    });
    assert.ok(calledUrl.includes("/api/v1/exports/rag-jsonl/chunk"));
    assert.ok(calledUrl.includes("offset=0"));
    assert.ok(calledUrl.includes("limitBytes=256000"));
    assert.equal(result.isError, undefined);
    const payload = JSON.parse(result.contents[0]!.text) as { content: string };
    assert.equal(payload.content, "abcdefghij");
  });
});
