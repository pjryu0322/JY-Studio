import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PayloadServiceError } from "../lib/distribution/payload-errors.ts";
import {
  buildChunkGenerationDualWrite,
  buildValidationRunGenerationDualWrite,
} from "../lib/search-generation/search-generation-binding.ts";
import { computeSearchGenerationFingerprint } from "../lib/search-generation/search-generation-fingerprint.ts";
import { defaultLocalEmbeddingDescriptor } from "../lib/search-generation/search-generation-types.ts";

describe("search generation invariants (P4.1)", () => {
  it("chunk dual-write sets column and metadata.indexGenerationId", () => {
    const dual = buildChunkGenerationDualWrite("gen-1", { unitType: "개념 설명" });
    assert.equal(dual.chunkGenerationId, "gen-1");
    assert.equal(dual.metadata.indexGenerationId, "gen-1");
    assert.equal(dual.metadata.unitType, "개념 설명");
  });

  it("validation dual-write keeps FK and legacy id identical", () => {
    const dual = buildValidationRunGenerationDualWrite("gen-1");
    assert.equal(dual.searchIndexGenerationId, "gen-1");
    assert.equal(dual.indexGenerationId, "gen-1");
  });

  it("fingerprint changes when embedding descriptor changes", () => {
    const base = {
      packId: "p",
      versionId: "v",
      pipelineRunId: "r",
      normalizedDocumentId: "nd",
      chunkGenerationId: "g",
      normalizedDocumentFingerprint: "fp",
      ...defaultLocalEmbeddingDescriptor(),
      chunks: [{ chunkId: "c1", contentHash: "h1" }],
    };
    const a = computeSearchGenerationFingerprint(base);
    const b = computeSearchGenerationFingerprint({
      ...base,
      embeddingModel: "other-model",
    });
    assert.notEqual(a, b);
  });

  it("PayloadServiceError exposes SEARCH_GENERATION_REQUIRED", () => {
    const err = new PayloadServiceError(
      "SEARCH_GENERATION_REQUIRED",
      "required",
      409,
    );
    assert.equal(err.code, "SEARCH_GENERATION_REQUIRED");
  });
});
