import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenizeSearchQuery, stripKoreanQuerySuffix } from "@/lib/search-utils";

test("P8 Korean query tokenization", async (t) => {
  await t.test("strips particles and expands merge synonyms", () => {
    const tokens = tokenizeSearchQuery("셀 병합과 관련된 기능이나 API를 찾아줘");
    assert.ok(tokens.includes("셀"));
    assert.ok(tokens.includes("병합"));
    assert.ok(tokens.includes("merge"));
    assert.ok(tokens.includes("merging"));
    assert.ok(!tokens.includes("관련된"));
    assert.ok(!tokens.includes("기능이나"));
    assert.ok(!tokens.includes("api"));
  });

  await t.test("strips trailing 할 and question marks", () => {
    assert.equal(stripKoreanQuerySuffix("병합할"), "병합");
    const tokens = tokenizeSearchQuery("How to merge cells using SpanMergingField?");
    assert.ok(tokens.includes("merge") || tokens.includes("병합"));
    assert.ok(tokens.some((x) => x.includes("spanmergingfield")));
    assert.ok(!tokens.some((x) => x.includes("?")));
  });
});
