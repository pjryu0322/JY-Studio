import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertResponseSize,
  buildAuthHeaders,
  buildQueryString,
  normalizeHttpError,
  JYKStoreClient,
} from "../../mcp-server/jykstore-client.ts";
import { McpBridgeError } from "../../mcp-server/errors.ts";

describe("mcp client helpers", () => {
  it("builds Authorization header", () => {
    const headers = buildAuthHeaders("secret-key");
    assert.equal(headers.Authorization, "Bearer secret-key");
    assert.equal(headers["Content-Type"], "application/json");
  });

  it("builds query strings", () => {
    assert.equal(buildQueryString({ knowledgePackId: "p1", topK: 5 }), "?knowledgePackId=p1&topK=5");
    assert.equal(buildQueryString({ skip: undefined }), "");
  });

  it("normalizes API error responses and preserves codes", () => {
    const normalized = normalizeHttpError({
      status: 404,
      bodyText: JSON.stringify({
        code: "PACK_NOT_FOUND",
        message: "Pack not found",
        requestId: "req_1",
      }),
    });
    assert.equal(normalized.code, "PACK_NOT_FOUND");
    assert.equal(normalized.requestId, "req_1");
    assert.equal(normalized.status, 404);
  });

  it("propagates Public API 429 QUOTA_EXCEEDED without leaking API key", () => {
    const normalized = normalizeHttpError({
      status: 429,
      bodyText: JSON.stringify({
        error: {
          code: "QUOTA_EXCEEDED",
          message: "API quota를 초과했습니다.",
          reason: "PER_MINUTE",
          retryAfterSeconds: 42,
        },
        usage: { requestId: "req_quota" },
      }),
    });
    assert.equal(normalized.code, "QUOTA_EXCEEDED");
    assert.equal(normalized.status, 429);
    assert.equal(normalized.requestId, "req_quota");
    const details = normalized.details as Record<string, unknown> | undefined;
    assert.equal(details?.reason, "PER_MINUTE");
    assert.equal(details?.retryAfterSeconds, 42);
    assert.ok(!JSON.stringify(normalized).includes("jyk_live_"));
    assert.ok(!JSON.stringify(normalized).includes("Bearer"));
  });

  it("enforces response size guard", () => {
    assert.doesNotThrow(() => assertResponseSize(10, 100));
    assert.throws(
      () => assertResponseSize(101, 100),
      (error: unknown) =>
        error instanceof McpBridgeError && error.code === "JYKSTORE_MCP_RESPONSE_TOO_LARGE",
    );
  });

  it("propagates PACK_NOT_FOUND from mocked fetch", async () => {
    const client = new JYKStoreClient({
      baseUrl: "http://localhost:3004",
      apiKey: "k",
      fetchImpl: (async () =>
        new Response(JSON.stringify({ code: "PACK_NOT_FOUND", message: "missing", requestId: "r1" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })) as typeof fetch,
    });

    await assert.rejects(
      () => client.getJson("/api/v1/exports/package", { knowledgePackId: "draft-pack" }),
      (error: unknown) =>
        error instanceof McpBridgeError &&
        error.code === "PACK_NOT_FOUND" &&
        error.requestId === "r1",
    );
  });

  it("getExportChunk calls Public API chunk path with maxResponseBytes", async () => {
    let calledUrl = "";
    const client = new JYKStoreClient({
      baseUrl: "http://localhost:3004",
      apiKey: "k",
      fetchImpl: (async (input) => {
        calledUrl = String(input);
        return new Response(
          JSON.stringify({
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
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }) as typeof fetch,
    });

    const chunk = await client.getExportChunk("rag-jsonl", {
      knowledgePackId: "pack-1",
      offset: 0,
      limitBytes: 256000,
    });
    assert.ok(calledUrl.includes("/api/v1/exports/rag-jsonl/chunk"));
    assert.ok(calledUrl.includes("offset=0"));
    assert.ok(calledUrl.includes("limitBytes=256000"));
    assert.equal(chunk.content, "abcdefghij");
  });
});
