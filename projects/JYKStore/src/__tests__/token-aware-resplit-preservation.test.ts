import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPassageEmbeddingText } from "@/lib/embedding/e5-embedding-text";
import type { PassageTokenCounter } from "@/lib/embedding/e5-tokenize-client";
import {
  assertPrimaryContentCoverage,
  splitBodyContentByTokens,
  splitTableRowsByTokens,
} from "@/lib/docling-knowledge/token-aware-chunk-split";

/** Dense counter to force multi-piece splits. */
const denseCounter: PassageTokenCounter = async (texts) =>
  texts.map((t) => Math.max(1, Math.ceil(t.trim().length / 2)));

function formatTableChunk(caption: string, headers: string[], rows: string[][]): string {
  const headerLine = headers.length > 0 ? headers.join(" | ") : "(헤더 없음)";
  const body = rows.map((r) => r.join(" | ")).join("\n");
  return [`표 캡션: ${caption}`, `컬럼: ${headerLine}`, body].filter(Boolean).join("\n\n");
}

describe("fallback resplit primary content preservation", () => {
  it("re-splitting primary-only content restores the parent primary exactly", async () => {
    const source = Array.from(
      { length: 50 },
      (_, i) => `문단 ${i + 1}. 재분할 검증용 한글 본문입니다.`,
    ).join("\n\n");
    const first = await splitBodyContentByTokens({
      content: source,
      title: "원본 제목 (99)",
      section: "본문",
      tags: ["감리"],
      countTokens: denseCounter,
      targetPassageTokens: 448,
      maxSequenceTokens: 512,
      overlapTokens: 48,
      sourceTextStart: 100,
    });
    assert.ok(first.length >= 2);
    const parent = first[1]!;
    assert.ok(parent.primaryContent.length > 0);

    // Simulate title-suffix overflow fallback: resplit primary only, no overlap.
    const resplit = await splitBodyContentByTokens({
      content: parent.primaryContent,
      title: "원본 제목 (2)",
      section: "본문",
      tags: ["감리"],
      countTokens: denseCounter,
      targetPassageTokens: 200,
      maxSequenceTokens: 512,
      overlapTokens: 0,
      sourceTextStart: parent.primarySourceTextStart,
    });
    assert.ok(resplit.length >= 1);
    const coverage = assertPrimaryContentCoverage({
      sourceText: parent.primaryContent,
      pieces: resplit,
    });
    assert.equal(coverage.ok, true, coverage.ok ? "" : coverage.message);
    for (const piece of resplit) {
      assert.equal(piece.hasOverlap, false);
      assert.equal(piece.actualOverlapTokens, 0);
      assert.ok(piece.primarySourceTextStart >= parent.primarySourceTextStart);
      assert.ok(piece.tokenCount <= 200);
      const passage = buildPassageEmbeddingText({
        title: "원본 제목 (2)",
        section: "본문",
        tags: ["감리"],
        content: piece.content,
      });
      assert.ok(passage.startsWith("passage:"));
    }
  });

  it("table cell continuation rejoins to the original long cell", async () => {
    const longCell = Array.from({ length: 180 }, (_, i) => `셀조각${i + 1}`).join(" ");
    const pieces = await splitTableRowsByTokens({
      caption: "표",
      headers: ["항목", "설명", "기준"],
      rows: [["A-1", longCell, "적합"]],
      title: "표 제목 (99)",
      countTokens: denseCounter,
      formatTableChunk,
      targetPassageTokens: 448,
      maxSequenceTokens: 512,
    });
    assert.ok(pieces.length >= 2);
    const joined = pieces.map((p) => p.primaryContent).join("").replace(/\s+/g, "");
    assert.equal(joined, longCell.replace(/\s+/g, ""));
    for (const piece of pieces) {
      assert.ok(piece.tokenCount <= 448);
      assert.equal((piece.tableMeta?.tableHeaders as string[]).length, 3);
      assert.match(piece.content, /A-1/);
      assert.match(piece.content, /적합/);
    }
  });
});
