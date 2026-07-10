import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRetrievalChunkContent,
  normalizeAndClamp,
} from "../lib/auto-pipeline/provider-auto-chunk-service.ts";
import { fixLoneSurrogates, sliceUtf16Safe } from "../lib/text-encoding-safe.ts";

describe("text encoding safe", () => {
  it("fixes lone high surrogates that break Prisma JSON", () => {
    const broken = `hello ${String.fromCharCode(0xd83d)} world`;
    const fixed = fixLoneSurrogates(broken);
    assert.equal(fixed.includes("\uFFFD"), true);
    assert.equal(fixed.includes(String.fromCharCode(0xd83d)), false);
    assert.doesNotThrow(() => JSON.parse(JSON.stringify({ content: fixed })));
  });

  it("preserves valid emoji pairs", () => {
    const emoji = "📄🚀";
    assert.equal(fixLoneSurrogates(emoji), emoji);
  });

  it("sliceUtf16Safe does not end on a high surrogate", () => {
    const text = `ab${String.fromCharCode(0xd83d, 0xdcc4)}cd`;
    // length units: a b high low c d = 6; slice 3 would cut after high
    const sliced = sliceUtf16Safe(text, 3);
    assert.equal(sliced, "ab");
    assert.equal(fixLoneSurrogates(sliced), sliced);
  });

  it("normalizeAndClamp removes lone surrogates from truncated content", () => {
    const high = String.fromCharCode(0xd83d);
    const text = `x`.repeat(50) + high + `y`.repeat(50);
    const out = normalizeAndClamp(text, 0, 60);
    assert.equal(out.includes(high), false);
  });

  it("buildRetrievalChunkContent survives excerpt ending with lone surrogate", () => {
    const high = String.fromCharCode(0xd83d);
    const content = buildRetrievalChunkContent({
      title: "README",
      draftContent: `docs/en/clipboard.md) - [${high}`,
      sourceExcerpt: `clip${high}`,
      headings: ["Documents"],
    });
    assert.equal(content.includes(high), false);
    assert.match(content, /관련 heading/);
  });
});
