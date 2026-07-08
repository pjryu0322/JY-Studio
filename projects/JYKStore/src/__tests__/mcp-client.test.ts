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
});
