import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  embeddingDescriptorsEqual,
  validateOperationalEmbeddingDescriptor,
} from "../lib/search-generation/search-generation-descriptor.ts";

const SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("validateOperationalEmbeddingDescriptor (P5.1)", () => {
  const valid = {
    embeddingProvider: "local-e5",
    embeddingModel: "dragonkue/multilingual-e5-small-ko-v2",
    embeddingModelRevision: SHA,
    embeddingDimension: 384,
    distanceMetric: "cosine",
  };

  it("accepts a pinned local-e5 descriptor", () => {
    assert.equal(validateOperationalEmbeddingDescriptor(valid).ok, true);
  });

  it("rejects legacy-unknown revision", () => {
    const result = validateOperationalEmbeddingDescriptor({
      ...valid,
      embeddingModelRevision: "legacy-unknown",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "SEARCH_GENERATION_REVISION_INVALID");
  });

  it("rejects branch-name revision", () => {
    const result = validateOperationalEmbeddingDescriptor({
      ...valid,
      embeddingModelRevision: "main",
    });
    assert.equal(result.ok, false);
  });

  it("rejects provider / dimension / distance drift", () => {
    assert.equal(
      validateOperationalEmbeddingDescriptor({ ...valid, embeddingProvider: "local-hash" }).ok,
      false,
    );
    assert.equal(
      validateOperationalEmbeddingDescriptor({ ...valid, embeddingDimension: 256 }).ok,
      false,
    );
    assert.equal(
      validateOperationalEmbeddingDescriptor({ ...valid, distanceMetric: "dot" }).ok,
      false,
    );
  });

  it("embeddingDescriptorsEqual detects field-level drift", () => {
    assert.equal(embeddingDescriptorsEqual(valid, valid), true);
    assert.equal(
      embeddingDescriptorsEqual(valid, { ...valid, embeddingModelRevision: "b".repeat(40) }),
      false,
    );
    assert.equal(
      embeddingDescriptorsEqual(valid, { ...valid, embeddingProvider: "local-hash" }),
      false,
    );
  });
});
