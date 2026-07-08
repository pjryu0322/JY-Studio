import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sliceUtf8TextByBytes } from "../../mcp-server/chunking.ts";
import { McpBridgeError } from "../../mcp-server/errors.ts";

describe("mcp chunking wrapper", () => {
  it("reuses shared UTF-8 slicing for ASCII", () => {
    const result = sliceUtf8TextByBytes("abcdefghij", 0, 4);
    assert.equal(result.content, "abcd");
    assert.equal(result.hasMore, true);
  });

  it("maps mid-character offset to MCP error code", () => {
    assert.throws(
      () => sliceUtf8TextByBytes("한", 1, 2),
      (error: unknown) =>
        error instanceof McpBridgeError &&
        error.code === "JYKSTORE_MCP_INVALID_CHUNK_RANGE",
    );
  });
});
