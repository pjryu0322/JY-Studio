import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyChunkQualitySubmitAllowed,
  runChunkQuality,
} from "@/lib/chunk-quality/chunk-quality-runner";

function baseChunk(overrides: Partial<Parameters<typeof runChunkQuality>[0]["chunks"][0]> = {}) {
  return {
    id: "chunk-1",
    sourceDocumentId: "doc-1",
    chunkType: "TEXT",
    title: "Integration overview",
    content: "A".repeat(200),
    section: "overview",
    tags: ["auth"],
    metadata: { sourceType: "API_SPEC" },
    isActive: true,
    ...overrides,
  };
}

describe("chunk quality runner", () => {
  it("fails when there are no active chunks", () => {
    const result = runChunkQuality({
      sources: [{ id: "doc-1", sourceType: "API_SPEC", validationStatus: "PASS" }],
      chunks: [],
      structureSections: [],
    });
    assert.equal(result.status, "FAIL");
    assert.equal(result.activeChunkCount, 0);
  });

  it("passes coverage when eligible sources have chunks", () => {
    const result = runChunkQuality({
      sources: [{ id: "doc-1", sourceType: "API_SPEC", validationStatus: "PASS" }],
      chunks: [baseChunk()],
      structureSections: [],
    });
    assert.equal(result.missingSourceChunkCount, 0);
    assert.ok(result.coverageScore >= 90);
  });

  it("flags orphan chunks", () => {
    const result = runChunkQuality({
      sources: [{ id: "doc-1", sourceType: "API_SPEC", validationStatus: "PASS" }],
      chunks: [baseChunk({ sourceDocumentId: null })],
      structureSections: [],
    });
    assert.equal(result.orphanChunkCount, 1);
    assert.ok(result.issues.some((i) => i.code === "CHUNK_ORPHAN"));
  });

  it("fails on empty chunk content", () => {
    const result = runChunkQuality({
      sources: [{ id: "doc-1", sourceType: "API_SPEC", validationStatus: "PASS" }],
      chunks: [baseChunk({ content: "   " })],
      structureSections: [],
    });
    assert.equal(result.status, "FAIL");
    assert.ok(result.issues.some((i) => i.code === "EMPTY_CHUNK"));
  });

  it("warns on short chunks", () => {
    const result = runChunkQuality({
      sources: [{ id: "doc-1", sourceType: "API_SPEC", validationStatus: "PASS" }],
      chunks: [baseChunk({ content: "short text only" })],
      structureSections: [],
    });
    assert.ok(result.shortChunkCount >= 1);
    assert.ok(result.issues.some((i) => i.code === "SHORT_CHUNK"));
  });

  it("warns on long chunks", () => {
    const result = runChunkQuality({
      sources: [{ id: "doc-1", sourceType: "API_SPEC", validationStatus: "PASS" }],
      chunks: [baseChunk({ content: "x".repeat(4500) })],
      structureSections: [],
    });
    assert.ok(result.longChunkCount >= 1);
  });

  it("detects duplicate chunks", () => {
    const content = "duplicate body ".repeat(20);
    const result = runChunkQuality({
      sources: [{ id: "doc-1", sourceType: "API_SPEC", validationStatus: "PASS" }],
      chunks: [
        baseChunk({ id: "c1", content }),
        baseChunk({ id: "c2", content }),
      ],
      structureSections: [],
    });
    assert.ok(result.duplicateChunkCount >= 1);
  });

  it("warns when metadata is missing", () => {
    const result = runChunkQuality({
      sources: [{ id: "doc-1", sourceType: "API_SPEC", validationStatus: "PASS" }],
      chunks: [
        baseChunk({
          section: null,
          tags: [],
          metadata: null,
        }),
      ],
      structureSections: [],
    });
    assert.ok(result.chunkWithoutMetadataCount >= 1);
  });

  it("allows submit classification for WARNING status", () => {
    assert.equal(classifyChunkQualitySubmitAllowed("WARNING"), true);
    assert.equal(classifyChunkQualitySubmitAllowed("FAIL"), false);
  });
});
