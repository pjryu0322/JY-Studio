import { test } from "node:test";
import assert from "node:assert/strict";
import {
  matchesAllMetadataFilters,
  scoreRetrievalChunk,
} from "@/lib/retrieval-ranking";

function makeChunk(overrides: Partial<{
  title: string;
  content: string;
  section: string | null;
  chunkType: string;
  tags: string[];
  sortOrder: number;
  createdAt: Date;
  metadata: Record<string, unknown> | null;
}> = {}) {
  return {
    title: "Callback 처리",
    content: "인증 결과 callback 처리와 오류코드 대응 예시",
    section: null,
    chunkType: "SAMPLE_CODE",
    tags: ["callback", "java"],
    sortOrder: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    metadata: null,
    ...overrides,
  };
}

test("matchesAllMetadataFilters returns true when every filter matches", () => {
  const metadata = { documentType: "SAMPLE_CODE", programmingLanguage: "Java" };
  assert.equal(
    matchesAllMetadataFilters(metadata, { documentType: "SAMPLE_CODE", programmingLanguage: "Java" }),
    true,
  );
});

test("matchesAllMetadataFilters returns false when one filter mismatches", () => {
  const metadata = { documentType: "SAMPLE_CODE", programmingLanguage: "Java" };
  assert.equal(
    matchesAllMetadataFilters(metadata, { documentType: "SAMPLE_CODE", programmingLanguage: "Kotlin" }),
    false,
  );
});

test("matchesAllMetadataFilters matches values inside string[] metadata", () => {
  const metadata = { documentType: ["GUIDE", "SAMPLE_CODE"] };
  assert.equal(matchesAllMetadataFilters(metadata, { documentType: "SAMPLE_CODE" }), true);
  assert.equal(matchesAllMetadataFilters(metadata, { documentType: "TUTORIAL" }), false);
});

test("matchesAllMetadataFilters resolves canonical filter key via alias metadata key", () => {
  const metadata = { language: "Java" };
  assert.equal(matchesAllMetadataFilters(metadata, { programmingLanguage: "Java" }), true);
});

test("matchesAllMetadataFilters returns true when no active filters", () => {
  assert.equal(matchesAllMetadataFilters(null, {}), true);
});

test("scoreRetrievalChunk reflects keyword matches in score and reasons", () => {
  const result = scoreRetrievalChunk({
    chunk: makeChunk(),
    tokens: ["callback"],
    filters: {},
  });
  assert.ok(result.score > 0);
  assert.ok(result.keywordScore > 0);
  assert.ok(result.matchReasons.length > 0);
});

test("scoreRetrievalChunk reflects metadata match in metadataScore", () => {
  const result = scoreRetrievalChunk({
    chunk: makeChunk({ metadata: { documentType: "SAMPLE_CODE" } }),
    tokens: [],
    filters: { documentType: "SAMPLE_CODE" },
  });
  assert.ok(result.metadataScore > 0);
  assert.ok(result.matchReasons.includes("metadata:documentType"));
});

test("scoreRetrievalChunk returns score 0 when no tokens and no filters", () => {
  const result = scoreRetrievalChunk({
    chunk: makeChunk({ metadata: { documentType: "SAMPLE_CODE" } }),
    tokens: [],
    filters: {},
  });
  assert.equal(result.score, 0);
  assert.equal(result.keywordScore, 0);
  assert.equal(result.metadataScore, 0);
  assert.deepEqual(result.matchReasons, []);
});

test("RETRIEVAL_QUERY_MAX_LENGTH is expanded to 2000", async () => {
  const { RETRIEVAL_QUERY_MAX_LENGTH, validateRetrievalQueryLength } = await import(
    "@/lib/retrieval-dto"
  );
  assert.equal(RETRIEVAL_QUERY_MAX_LENGTH, 2000);
  assert.equal(validateRetrievalQueryLength("a".repeat(2000)).ok, true);
  assert.equal(validateRetrievalQueryLength("a".repeat(2001)).ok, false);
});
