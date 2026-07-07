import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTopK, validateAndNormalizeFilters } from "@/lib/retrieval-filter";
import { validateAndNormalizeChunkMetadata } from "@/lib/retrieval-metadata";
import { DEFAULT_TOP_K } from "@/lib/retrieval-dto";

test("normalizeTopK returns default for undefined/null", () => {
  const a = normalizeTopK(undefined);
  assert.equal(a.ok, true);
  if (a.ok) assert.equal(a.topK, DEFAULT_TOP_K);

  const b = normalizeTopK(null);
  assert.equal(b.ok, true);
  if (b.ok) assert.equal(b.topK, DEFAULT_TOP_K);
});

test("normalizeTopK accepts 1..20", () => {
  for (const n of [1, 8, 20]) {
    const result = normalizeTopK(n);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.topK, n);
  }
});

test("normalizeTopK rejects out-of-range and non-numbers", () => {
  for (const n of [0, -3, 21, 100]) {
    assert.equal(normalizeTopK(n).ok, false);
  }
  for (const v of ["8", true, {}, Number.NaN]) {
    assert.equal(normalizeTopK(v).ok, false);
  }
});

test("validateAndNormalizeFilters passes empty for undefined/null", () => {
  for (const v of [undefined, null]) {
    const result = validateAndNormalizeFilters(v);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.filters, {});
      assert.deepEqual(result.aliasHits, []);
    }
  }
});

test("validateAndNormalizeFilters normalizes language and version aliases", () => {
  const result = validateAndNormalizeFilters({ language: "Java", version: "1.0.0" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.filters.programmingLanguage, "Java");
    assert.equal(result.filters.productVersion, "1.0.0");
    assert.deepEqual(result.aliasHits.sort(), ["language", "version"]);
  }
});

test("validateAndNormalizeFilters rejects unknown keys", () => {
  const result = validateAndNormalizeFilters({ notAKey: "x" });
  assert.equal(result.ok, false);
});

test("validateAndNormalizeFilters requires string values", () => {
  const result = validateAndNormalizeFilters({ documentType: ["SAMPLE_CODE"] });
  assert.equal(result.ok, false);
});

test("validateAndNormalizeChunkMetadata keeps allowed canonical keys", () => {
  const result = validateAndNormalizeChunkMetadata({
    documentType: "SAMPLE_CODE",
    programmingLanguage: "Java",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.metadata, {
      documentType: "SAMPLE_CODE",
      programmingLanguage: "Java",
    });
  }
});

test("validateAndNormalizeChunkMetadata blocks sensitive keys", () => {
  const result = validateAndNormalizeChunkMetadata({ apiKey: "secret" });
  assert.equal(result.ok, false);
});

test("validateAndNormalizeChunkMetadata returns null for empty object and null input", () => {
  const empty = validateAndNormalizeChunkMetadata({});
  assert.equal(empty.ok, true);
  if (empty.ok) assert.equal(empty.metadata, null);

  const nil = validateAndNormalizeChunkMetadata(null);
  assert.equal(nil.ok, true);
  if (nil.ok) assert.equal(nil.metadata, null);
});

test("validateAndNormalizeChunkMetadata trims string[] and drops empties", () => {
  const result = validateAndNormalizeChunkMetadata({ documentType: ["  A  ", "", "B"] });
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.metadata, { documentType: ["A", "B"] });
});

test("validateAndNormalizeChunkMetadata normalizes language alias to canonical key", () => {
  const result = validateAndNormalizeChunkMetadata({ language: "Java" });
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.metadata, { programmingLanguage: "Java" });
});
