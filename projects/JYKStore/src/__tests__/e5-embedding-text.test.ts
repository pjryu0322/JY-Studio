import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertE5PassageText,
  buildPassageEmbeddingText,
  buildQueryEmbeddingText,
  estimateEmbeddingTokenCount,
} from "@/lib/embedding/e5-embedding-text";
import { isEmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";

describe("e5 embedding text", () => {
  it("buildQueryEmbeddingText adds query: prefix", () => {
    assert.equal(buildQueryEmbeddingText("hello"), "query: hello");
    assert.equal(buildQueryEmbeddingText("query: already"), "query: already");
  });

  it("buildPassageEmbeddingText adds passage: prefix", () => {
    const text = buildPassageEmbeddingText({
      title: "제목",
      content: "본문",
      section: "섹션",
      tags: ["tag"],
    });
    assert.ok(text.startsWith("passage:"));
    assert.ok(text.includes("제목"));
    assert.ok(text.includes("본문"));
  });

  it("rejects passage over token limit", () => {
    const huge = buildPassageEmbeddingText({
      title: "t",
      content: "가".repeat(3000),
      section: null,
      tags: [],
    });
    assert.throws(
      () => assertE5PassageText(huge),
      (error: unknown) =>
        isEmbeddingProviderError(error) && error.code === "EMBEDDING_TOKEN_LIMIT_EXCEEDED",
    );
  });

  it("estimateEmbeddingTokenCount is conservative", () => {
    assert.ok(estimateEmbeddingTokenCount("abcd") >= 1);
    assert.equal(estimateEmbeddingTokenCount(""), 0);
  });
});
