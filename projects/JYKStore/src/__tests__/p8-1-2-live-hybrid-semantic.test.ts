import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { tokenizeSearchQueryDetailed } from "@/lib/search-utils";

describe("P8.1.2 live hybrid prerequisites", () => {
  it("preserves Korean adjectives and keeps expansions out of lexical prefilter", () => {
    const d = tokenizeSearchQueryDetailed("같은 값이 이어지는 칸들을 하나처럼 보이게 하려면?");
    assert.ok(d.sourceTokens.includes("같은"));
    assert.ok(d.scoringTokens.includes("merge") || d.scoringTokens.includes("병합"));
    assert.ok(!d.lexicalPrefilterTokens.includes("merge"));
    assert.ok(!d.lexicalPrefilterTokens.includes("병합"));
  });

  it("enriches hybrid query embedding text with synonym expansions", async () => {
    const { buildHybridQueryEmbeddingText } = await import("@/lib/search-utils");
    const enriched = buildHybridQueryEmbeddingText("인접한 칸을 합쳐서 보여주는 기능은?");
    assert.ok(enriched.includes("merge") || enriched.includes("병합"));
    assert.ok(enriched.includes("인접한"));
  });

  it("hybrid JSON fallback remains generation-scoped independent of lexical ids", () => {
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "..",
        "lib",
        "retrieval",
        "hybrid-ranking-service.ts",
      ),
      "utf8",
    );
    assert.ok(source.includes("findJsonEmbeddingNeighbors"));
    assert.ok(source.includes("querySearchIndexVectorsByGeneration"));
  });
});
