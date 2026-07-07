import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatMetadataSummary,
  parseMetadataText,
  parseTagsText,
} from "@/components/chunks/chunk-ui-utils";

test("parseTagsText trims, drops empty, and dedupes tags", () => {
  assert.deepEqual(parseTagsText("  java , callback ,, java ,  "), ["java", "callback"]);
  assert.deepEqual(parseTagsText(""), []);
  assert.deepEqual(parseTagsText(",, ,"), []);
});

test("parseMetadataText returns null metadata for empty input", () => {
  const result = parseMetadataText("   ");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.metadata, null);
});

test("parseMetadataText parses a JSON object", () => {
  const result = parseMetadataText('{"documentType":"SAMPLE_CODE"}');
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.metadata, { documentType: "SAMPLE_CODE" });
});

test("parseMetadataText fails on invalid JSON", () => {
  const result = parseMetadataText("{not-json}");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "metadata JSON을 파싱하지 못했습니다.");
});

test("parseMetadataText rejects array / string / number", () => {
  for (const value of ["[1,2,3]", '"a string"', "42"]) {
    const result = parseMetadataText(value);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "metadata는 JSON object여야 합니다.");
  }
});

test("formatMetadataSummary formats object entries", () => {
  assert.equal(
    formatMetadataSummary({ programmingLanguage: "Java", documentType: "SAMPLE_CODE" }),
    "programmingLanguage: Java · documentType: SAMPLE_CODE",
  );
});

test("formatMetadataSummary joins array values with /", () => {
  assert.equal(formatMetadataSummary({ tags: ["a", "b"] }), "tags: a/b");
});

test("formatMetadataSummary returns empty string for null", () => {
  assert.equal(formatMetadataSummary(null), "");
});
