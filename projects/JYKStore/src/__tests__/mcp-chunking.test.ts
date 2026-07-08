import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sliceUtf8TextByBytes } from "../../mcp-server/chunking.ts";
import { McpBridgeError } from "../../mcp-server/errors.ts";

describe("mcp chunking", () => {
  it("slices ASCII by bytes", () => {
    const result = sliceUtf8TextByBytes("abcdefghij", 0, 4);
    assert.equal(result.content, "abcd");
    assert.equal(result.byteLength, 4);
    assert.equal(result.nextOffset, 4);
    assert.equal(result.hasMore, true);
    assert.equal(result.totalBytes, 10);
  });

  it("slices Korean without corruption", () => {
    const text = "한글테스트";
    const first = sliceUtf8TextByBytes(text, 0, 5);
    assert.ok(Buffer.byteLength(first.content, "utf8") <= 5);
    assert.ok(!first.content.includes("\uFFFD"));
    const second = sliceUtf8TextByBytes(text, first.nextOffset, 100);
    assert.equal(first.content + second.content, text);
    assert.equal(second.hasMore, false);
  });

  it("slices emoji without corruption", () => {
    const text = "hi😀bye";
    const mid = Buffer.from(text, "utf8");
    // grab enough bytes for "hi" + partial emoji boundary safety
    const first = sliceUtf8TextByBytes(text, 0, 3);
    assert.equal(first.content, "hi");
    assert.equal(first.byteLength, 2);
    const rest = sliceUtf8TextByBytes(text, first.nextOffset, mid.length);
    assert.equal(first.content + rest.content, text);
  });

  it("returns empty when offset is beyond end", () => {
    const result = sliceUtf8TextByBytes("abc", 10, 100);
    assert.equal(result.content, "");
    assert.equal(result.byteLength, 0);
    assert.equal(result.hasMore, false);
    assert.equal(result.nextOffset, 3);
  });

  it("handles exact boundary", () => {
    const result = sliceUtf8TextByBytes("abcd", 0, 4);
    assert.equal(result.content, "abcd");
    assert.equal(result.hasMore, false);
    assert.equal(result.nextOffset, 4);
  });

  it("rejects offset in the middle of a multibyte character", () => {
    const text = "한";
    assert.equal(Buffer.byteLength(text, "utf8"), 3);
    assert.throws(
      () => sliceUtf8TextByBytes(text, 1, 2),
      (error: unknown) =>
        error instanceof McpBridgeError &&
        error.code === "JYKSTORE_MCP_INVALID_CHUNK_RANGE",
    );
  });
});
