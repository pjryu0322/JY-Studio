import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeSearchGenerationFingerprint,
  type SearchGenerationFingerprintInput,
} from "../lib/search-generation/search-generation-fingerprint.ts";
import { isSearchGenerationCurrentForBinding } from "../lib/search-generation/search-generation-types.ts";

function baseInput(): SearchGenerationFingerprintInput {
  return {
    packId: "pack-1",
    versionId: "version-1",
    pipelineRunId: "pipe-1",
    normalizedDocumentId: "nd-1",
    chunkGenerationId: "chunkgen-1",
    normalizedDocumentFingerprint: "ndfp-1",
    embeddingProvider: "local-hash",
    embeddingModel: "local-hash-v1",
    embeddingDimension: 256,
    distanceMetric: "cosine",
    chunks: [
      { chunkId: "c-2", contentHash: "h2" },
      { chunkId: "c-1", contentHash: "h1" },
    ],
  };
}

describe("computeSearchGenerationFingerprint (§37)", () => {
  it("is deterministic for identical input", () => {
    assert.equal(
      computeSearchGenerationFingerprint(baseInput()),
      computeSearchGenerationFingerprint(baseInput()),
    );
  });

  it("is invariant to chunk order", () => {
    const a = computeSearchGenerationFingerprint(baseInput());
    const reordered = baseInput();
    reordered.chunks = [
      { chunkId: "c-1", contentHash: "h1" },
      { chunkId: "c-2", contentHash: "h2" },
    ];
    assert.equal(computeSearchGenerationFingerprint(reordered), a);
  });

  it("changes when a chunk contentHash changes", () => {
    const a = computeSearchGenerationFingerprint(baseInput());
    const changed = baseInput();
    changed.chunks[0]!.contentHash = "h2-changed";
    assert.notEqual(computeSearchGenerationFingerprint(changed), a);
  });

  it("changes when a chunk is added", () => {
    const a = computeSearchGenerationFingerprint(baseInput());
    const changed = baseInput();
    changed.chunks.push({ chunkId: "c-3", contentHash: "h3" });
    assert.notEqual(computeSearchGenerationFingerprint(changed), a);
  });

  it("changes when the embedding provider changes", () => {
    const a = computeSearchGenerationFingerprint(baseInput());
    const changed = { ...baseInput(), embeddingProvider: "openai" };
    assert.notEqual(computeSearchGenerationFingerprint(changed), a);
  });

  it("changes when the embedding model changes", () => {
    const a = computeSearchGenerationFingerprint(baseInput());
    const changed = { ...baseInput(), embeddingModel: "text-embedding-3" };
    assert.notEqual(computeSearchGenerationFingerprint(changed), a);
  });

  it("changes when the embedding dimension changes", () => {
    const a = computeSearchGenerationFingerprint(baseInput());
    const changed = { ...baseInput(), embeddingDimension: 512 };
    assert.notEqual(computeSearchGenerationFingerprint(changed), a);
  });

  it("changes when the distance metric changes", () => {
    const a = computeSearchGenerationFingerprint(baseInput());
    const changed = { ...baseInput(), distanceMetric: "dot" };
    assert.notEqual(computeSearchGenerationFingerprint(changed), a);
  });

  it("changes when the normalized document fingerprint changes", () => {
    const a = computeSearchGenerationFingerprint(baseInput());
    const changed = { ...baseInput(), normalizedDocumentFingerprint: "ndfp-2" };
    assert.notEqual(computeSearchGenerationFingerprint(changed), a);
  });
});

describe("isSearchGenerationCurrentForBinding", () => {
  const binding = {
    packId: "pack-1",
    versionId: "version-1",
    pipelineRunId: "pipe-1",
    normalizedDocumentId: "nd-1",
    chunkGenerationId: "chunkgen-1",
    fingerprint: "fp-1",
  };
  const current = { ...binding, status: "READY" as const };

  it("returns true for a matching non-inactive generation", () => {
    assert.equal(isSearchGenerationCurrentForBinding(current, binding), true);
  });

  it("returns false for a STALE generation", () => {
    assert.equal(
      isSearchGenerationCurrentForBinding({ ...current, status: "STALE" }, binding),
      false,
    );
  });

  it("returns false for a RETIRED generation", () => {
    assert.equal(
      isSearchGenerationCurrentForBinding({ ...current, status: "RETIRED" }, binding),
      false,
    );
  });

  it("returns false when the fingerprint drifts", () => {
    assert.equal(
      isSearchGenerationCurrentForBinding({ ...current, fingerprint: "fp-2" }, binding),
      false,
    );
  });

  it("returns false when the pipeline run drifts", () => {
    assert.equal(
      isSearchGenerationCurrentForBinding({ ...current, pipelineRunId: "pipe-2" }, binding),
      false,
    );
  });
});
