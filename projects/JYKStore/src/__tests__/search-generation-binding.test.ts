import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PayloadServiceError } from "../lib/distribution/payload-errors.ts";
import {
  assertValidationRunGenerationConsistent,
  buildChunkGenerationDualWrite,
  buildValidationRunGenerationDualWrite,
  resolveChunkGenerationId,
  resolveValidationRunSearchGenerationId,
} from "../lib/search-generation/search-generation-binding.ts";

describe("search generation dual-read/write binding (§40)", () => {
  it("prefers the chunk column over legacy metadata", () => {
    assert.equal(
      resolveChunkGenerationId({ chunkGenerationId: "gen-col", metadata: { indexGenerationId: "gen-meta" } }),
      "gen-col",
    );
  });

  it("falls back to metadata.indexGenerationId when column is null", () => {
    assert.equal(
      resolveChunkGenerationId({ chunkGenerationId: null, metadata: { indexGenerationId: "gen-meta" } }),
      "gen-meta",
    );
  });

  it("returns null when neither column nor metadata is present", () => {
    assert.equal(resolveChunkGenerationId({ chunkGenerationId: null, metadata: null }), null);
  });

  it("prefers the validation run FK over the legacy string", () => {
    assert.equal(
      resolveValidationRunSearchGenerationId({ searchIndexGenerationId: "fk", indexGenerationId: "legacy" }),
      "fk",
    );
  });

  it("falls back to legacy indexGenerationId when FK is null", () => {
    assert.equal(
      resolveValidationRunSearchGenerationId({ searchIndexGenerationId: null, indexGenerationId: "legacy" }),
      "legacy",
    );
  });

  it("allows matching FK and legacy values", () => {
    assert.doesNotThrow(() =>
      assertValidationRunGenerationConsistent({ searchIndexGenerationId: "g1", indexGenerationId: "g1" }),
    );
  });

  it("blocks mismatched FK and legacy values", () => {
    assert.throws(
      () =>
        assertValidationRunGenerationConsistent({ searchIndexGenerationId: "g1", indexGenerationId: "g2" }),
      (e: unknown) => e instanceof PayloadServiceError && e.code === "SEARCH_GENERATION_MISMATCH",
    );
  });

  it("allows one-sided values (legacy-only or fk-only)", () => {
    assert.doesNotThrow(() =>
      assertValidationRunGenerationConsistent({ searchIndexGenerationId: null, indexGenerationId: "legacy" }),
    );
    assert.doesNotThrow(() =>
      assertValidationRunGenerationConsistent({ searchIndexGenerationId: "fk", indexGenerationId: null }),
    );
  });

  it("dual-writes chunk column and mirrors metadata", () => {
    const out = buildChunkGenerationDualWrite("gen-1", { existing: true });
    assert.equal(out.chunkGenerationId, "gen-1");
    assert.equal(out.metadata.indexGenerationId, "gen-1");
    assert.equal(out.metadata.existing, true);
  });

  it("dual-writes validation run FK and legacy string to the same value", () => {
    const out = buildValidationRunGenerationDualWrite("gen-2");
    assert.equal(out.searchIndexGenerationId, "gen-2");
    assert.equal(out.indexGenerationId, "gen-2");
  });
});
