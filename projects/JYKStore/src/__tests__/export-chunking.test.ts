import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_EXPORT_CHUNK_LIMIT_BYTES,
  MAX_EXPORT_CHUNK_LIMIT_BYTES,
  MIN_EXPORT_CHUNK_LIMIT_BYTES,
  parseExportChunkRequestFromSearchParams,
} from "@/lib/export-chunk-dto";
import { ExportChunkRangeError, sliceUtf8TextByBytes } from "@/lib/export-chunking";
import { sliceExportSourceToChunkResponse } from "@/lib/export-chunk-service";

describe("export chunking shared lib", () => {
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
    const first = sliceUtf8TextByBytes(text, 0, 3);
    assert.equal(first.content, "hi");
    assert.equal(first.byteLength, 2);
    const rest = sliceUtf8TextByBytes(text, first.nextOffset, mid.length);
    assert.equal(first.content + rest.content, text);
  });

  it("returns empty when offset is beyond end", () => {
    const result = sliceUtf8TextByBytes("abc", 10, 100);
    assert.equal(result.content, "");
    assert.equal(result.hasMore, false);
    assert.equal(result.nextOffset, 3);
  });

  it("rejects offset in the middle of a multibyte character", () => {
    assert.throws(
      () => sliceUtf8TextByBytes("한", 1, 2),
      (error: unknown) => error instanceof ExportChunkRangeError,
    );
  });
});

describe("export chunk request parsing", () => {
  it("defaults offset and limitBytes", () => {
    const parsed = parseExportChunkRequestFromSearchParams(
      new URLSearchParams("knowledgePackId=pack-1"),
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.request.offset, 0);
    assert.equal(parsed.request.limitBytes, DEFAULT_EXPORT_CHUNK_LIMIT_BYTES);
  });

  it("rejects invalid offset and oversize limitBytes", () => {
    const badOffset = parseExportChunkRequestFromSearchParams(
      new URLSearchParams("knowledgePackId=pack-1&offset=-1"),
    );
    assert.equal(badOffset.ok, false);

    const badLimit = parseExportChunkRequestFromSearchParams(
      new URLSearchParams(
        `knowledgePackId=pack-1&limitBytes=${MAX_EXPORT_CHUNK_LIMIT_BYTES + 1}`,
      ),
    );
    assert.equal(badLimit.ok, false);

    const tooSmall = parseExportChunkRequestFromSearchParams(
      new URLSearchParams(
        `knowledgePackId=pack-1&limitBytes=${MIN_EXPORT_CHUNK_LIMIT_BYTES - 1}`,
      ),
    );
    assert.equal(tooSmall.ok, false);
  });
});

describe("export chunk response helper", () => {
  it("builds hasMore/nextOffset/byteLength/totalBytes for a 2000-byte source", () => {
    const source = "a".repeat(2000);
    const chunk = sliceExportSourceToChunkResponse({
      knowledgePackId: "pack-1",
      exportType: "rag-jsonl",
      sourceText: source,
      offset: 0,
      limitBytes: 1024,
    });
    assert.equal(chunk.mimeType, "application/x-ndjson");
    assert.equal(chunk.byteLength, 1024);
    assert.equal(chunk.nextOffset, 1024);
    assert.equal(chunk.hasMore, true);
    assert.equal(chunk.totalBytes, 2000);
    assert.equal(chunk.content.length, 1024);
  });

  it("uses application/json mime for package and graph", () => {
    const packageChunk = sliceExportSourceToChunkResponse({
      knowledgePackId: "pack-1",
      exportType: "package",
      sourceText: '{"ok":true}',
      offset: 0,
      limitBytes: 1024,
    });
    assert.equal(packageChunk.mimeType, "application/json");
    const graphChunk = sliceExportSourceToChunkResponse({
      knowledgePackId: "pack-1",
      exportType: "graph",
      sourceText: '{"nodes":[]}',
      offset: 0,
      limitBytes: 1024,
    });
    assert.equal(graphChunk.mimeType, "application/json");
  });
});
