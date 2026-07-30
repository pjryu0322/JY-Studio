import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyQueryToken,
  EXPANSION_TOKEN_BUDGET,
  SOURCE_TOKEN_BUDGET,
  stripKoreanQuerySuffix,
  tokenizeSearchQuery,
  tokenizeSearchQueryDetailed,
} from "@/lib/search-utils";

test("P8.1.1 Korean query tokenization", async (t) => {
  await t.test("strips particles, keeps domain tokens, expands merge synonyms", () => {
    const detailed = tokenizeSearchQueryDetailed("셀 병합과 관련된 기능이나 API를 찾아줘");
    assert.ok(detailed.scoringTokens.includes("셀"));
    assert.ok(detailed.scoringTokens.includes("병합"));
    assert.ok(detailed.scoringTokens.includes("merge"));
    assert.ok(detailed.scoringTokens.includes("api"));
    assert.ok(!detailed.scoringTokens.includes("관련된"));
    assert.ok(!detailed.scoringTokens.includes("찾아줘"));
    assert.equal(classifyQueryToken("api"), "DOMAIN_TERM");
    assert.equal(classifyQueryToken("병합"), "CORE_TERM");
    assert.ok(detailed.lexicalPrefilterTokens.includes("병합"));
    assert.ok(!detailed.lexicalPrefilterTokens.includes("api"));
    assert.ok(!detailed.lexicalPrefilterTokens.includes("셀"));
  });

  await t.test("source tokens are not truncated by synonym expansions", () => {
    const words = Array.from({ length: SOURCE_TOKEN_BUDGET + 3 }, (_, i) => `coreterm${i}`);
    words[0] = "병합";
    const detailed = tokenizeSearchQueryDetailed(words.join(" "));
    assert.equal(detailed.sourceTokens.length, SOURCE_TOKEN_BUDGET);
    assert.ok(detailed.sourceTokens.includes("병합"));
    assert.ok(detailed.expansionTokens.length <= EXPANSION_TOKEN_BUDGET);
    assert.ok(detailed.truncatedSource.length >= 1);
    // Synonym expansions must not drop later source cores from the source budget.
    assert.ok(detailed.sourceTokens.includes(`coreterm${SOURCE_TOKEN_BUDGET - 1}`));
  });

  await t.test("domain-only queries omit domain flood from lexical prefilter", () => {
    const detailed = tokenizeSearchQueryDetailed("api grid cell rmate");
    assert.ok(detailed.scoringTokens.includes("api"));
    assert.equal(detailed.lexicalPrefilterTokens.length, 0);
  });

  await t.test("synonym expansions stay out of lexical prefilter", () => {
    const detailed = tokenizeSearchQueryDetailed(
      "같은 값이 이어지는 칸들을 하나처럼 보이게 하려면?",
    );
    assert.ok(detailed.expansionTokens.includes("merge"));
    assert.ok(detailed.scoringTokens.includes("merge"));
    assert.ok(!detailed.lexicalPrefilterTokens.includes("merge"));
    assert.ok(!detailed.lexicalPrefilterTokens.includes("병합"));
    assert.ok(detailed.lexicalPrefilterTokens.includes("이어지는"));
  });

  await t.test("preserves 함께 and drops topic-marked stopwords", () => {
    const detailed = tokenizeSearchQueryDetailed("셀에 줄 수와 스타일을 함께 넣는 속성 객체는?");
    assert.ok(detailed.sourceTokens.includes("함께"));
    assert.ok(!detailed.sourceTokens.includes("함"));
    assert.ok(!detailed.sourceTokens.includes("기능은"));
    assert.ok(detailed.scoringTokens.includes("rowspan") || detailed.scoringTokens.includes("style"));
  });

  await t.test("paraphrase synonyms without explicit merge word", () => {
    const tokens = tokenizeSearchQuery("여러 칸을 합쳐서 하나의 영역처럼 보이게");
    assert.ok(tokens.includes("합쳐") || tokens.includes("merge") || tokens.includes("병합"));
    assert.ok(tokens.includes("칸") || tokens.includes("cell") || tokens.includes("셀"));
  });

  await t.test("strips trailing 할 and question marks", () => {
    assert.equal(stripKoreanQuerySuffix("병합할"), "병합");
    const tokens = tokenizeSearchQuery("How to merge cells using SpanMergingField?");
    assert.ok(tokens.includes("merge") || tokens.includes("병합"));
    assert.ok(tokens.some((x) => x.includes("spanmergingfield")));
    assert.ok(tokens.includes("cells"));
    assert.ok(!tokens.some((x) => x.includes("?")));
  });
});
