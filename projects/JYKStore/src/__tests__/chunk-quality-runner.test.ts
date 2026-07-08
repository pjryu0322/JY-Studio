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

function baseSection(
  overrides: Partial<Parameters<typeof runChunkQuality>[0]["structureSections"][0]> = {},
) {
  return {
    sectionKey: "AUTH_FLOW",
    title: "인증 흐름",
    required: true,
    covered: true,
    matchedDocIds: ["doc-1"],
    matchedSignals: ["keyword:auth"],
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

  it("detects exact duplicate chunks", () => {
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
    assert.ok(
      result.issues.some(
        (i) => i.code === "CHUNK_DUPLICATE_EXACT" || i.code === "CHUNK_DUPLICATE_NEAR",
      ),
    );
  });

  it("detects near duplicate chunks with high Jaccard overlap", () => {
    const s1 = "sentence one about authentication flow for clients. ";
    const s2 = "sentence two about callback handling and retries. ";
    const s3 = "sentence three about error codes and recovery. ";
    const contentA = (s1 + s2 + s3).repeat(4);
    const contentB = (s2 + s3 + s1).repeat(4);
    const result = runChunkQuality({
      sources: [{ id: "doc-1", sourceType: "API_SPEC", validationStatus: "PASS" }],
      chunks: [
        baseChunk({ id: "c1", title: "Auth request overview", content: contentA, section: "auth" }),
        baseChunk({ id: "c2", title: "Auth response details", content: contentB, section: "auth" }),
      ],
      structureSections: [],
    });
    assert.ok(result.issues.some((i) => i.code === "CHUNK_DUPLICATE_NEAR"));
    assert.ok(result.duplicateChunkCount >= 1);
  });

  it("detects prefix overlap duplicates", () => {
    const prefix = "prefix overlap body text segment ".repeat(8);
    const longBody = `${prefix}and unique trailing content for the longer chunk only.`;
    const result = runChunkQuality({
      sources: [{ id: "doc-1", sourceType: "API_SPEC", validationStatus: "PASS" }],
      chunks: [
        baseChunk({ id: "c-long", content: longBody, section: "api" }),
        baseChunk({ id: "c-short", content: prefix.trim(), section: "api" }),
      ],
      structureSections: [],
    });
    assert.ok(
      result.issues.some((i) => i.code === "CHUNK_DUPLICATE_PREFIX_OVERLAP"),
    );
  });

  it("does not near-duplicate across different source and section", () => {
    const shared = "공통 안내 문구입니다. ";
    const result = runChunkQuality({
      sources: [
        { id: "doc-1", sourceType: "API_SPEC", validationStatus: "PASS" },
        { id: "doc-2", sourceType: "FAQ", validationStatus: "PASS" },
      ],
      chunks: [
        baseChunk({
          id: "c1",
          sourceDocumentId: "doc-1",
          section: "alpha",
          content: shared.repeat(10) + "doc one specific tail content.",
        }),
        baseChunk({
          id: "c2",
          sourceDocumentId: "doc-2",
          section: "beta",
          content: shared.repeat(10) + "doc two specific tail content.",
        }),
      ],
      structureSections: [],
    });
    assert.equal(
      result.issues.some((i) => i.code === "CHUNK_DUPLICATE_NEAR"),
      false,
    );
  });

  it("skips near duplicate for short non-exact bodies", () => {
    const result = runChunkQuality({
      sources: [{ id: "doc-1", sourceType: "API_SPEC", validationStatus: "PASS" }],
      chunks: [
        baseChunk({ id: "c1", content: "tiny a", section: "s1" }),
        baseChunk({ id: "c2", content: "tiny b", section: "s1" }),
      ],
      structureSections: [],
    });
    assert.equal(
      result.issues.some((i) =>
        ["CHUNK_DUPLICATE_NEAR", "CHUNK_DUPLICATE_PREFIX_OVERLAP"].includes(i.code),
      ),
      false,
    );
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

  it("keeps structure alignment score when section-linked chunk exists", () => {
    const result = runChunkQuality({
      sources: [{ id: "doc-1", sourceType: "API_SPEC", validationStatus: "PASS" }],
      chunks: [baseChunk({ sourceDocumentId: "doc-1" })],
      structureSections: [baseSection()],
    });
    assert.ok(result.structureAlignmentScore >= 90);
    assert.equal(
      result.issues.some((i) => i.code === "CHUNK_STRUCTURE_SECTION_MISSING"),
      false,
    );
  });

  it("emits structure section missing when no aligned chunk", () => {
    const result = runChunkQuality({
      sources: [
        { id: "doc-1", sourceType: "API_SPEC", validationStatus: "PASS" },
        { id: "doc-2", sourceType: "FAQ", validationStatus: "PASS" },
      ],
      chunks: [
        baseChunk({
          sourceDocumentId: "doc-1",
          title: "Unrelated",
          section: "misc",
          tags: [],
          content: "Z".repeat(200),
        }),
      ],
      structureSections: [
        baseSection({
          matchedDocIds: ["doc-2"],
          matchedSignals: [],
        }),
      ],
    });
    assert.ok(result.structureAlignmentScore < 100);
    assert.ok(result.issues.some((i) => i.code === "CHUNK_STRUCTURE_SECTION_MISSING"));
  });

  it("aligns via matched signal in chunk content", () => {
    const result = runChunkQuality({
      sources: [
        { id: "doc-1", sourceType: "API_SPEC", validationStatus: "PASS" },
        { id: "doc-2", sourceType: "CALLBACK_GUIDE", validationStatus: "PASS" },
      ],
      chunks: [
        baseChunk({
          sourceDocumentId: "doc-2",
          title: "Callbacks",
          section: "webhooks",
          tags: ["callback"],
          content: "Handle callback payload retries securely. ".repeat(5),
        }),
      ],
      structureSections: [
        baseSection({
          matchedDocIds: ["doc-2"],
          matchedSignals: ["keyword:callback"],
        }),
      ],
    });
    assert.equal(
      result.issues.some((i) => i.code === "CHUNK_STRUCTURE_SECTION_MISSING"),
      false,
    );
  });

  it("allows submit classification for WARNING status", () => {
    assert.equal(classifyChunkQualitySubmitAllowed("WARNING"), true);
    assert.equal(classifyChunkQualitySubmitAllowed("FAIL"), false);
  });
});
