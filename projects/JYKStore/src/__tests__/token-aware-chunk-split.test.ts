import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPassageEmbeddingText } from "@/lib/embedding/e5-embedding-text";
import type { PassageTokenCounter } from "@/lib/embedding/e5-tokenize-client";
import {
  evaluatePassageTokenGate,
  passageTokenGateStatus,
  splitBodyContentByTokens,
  splitTableRowsByTokens,
} from "@/lib/docling-knowledge/token-aware-chunk-split";

/** Deterministic fake tokenizer: ~2 chars/token to stress Korean-like density. */
const denseCounter: PassageTokenCounter = async (texts) =>
  texts.map((t) => Math.max(1, Math.ceil(t.trim().length / 2)));

function formatTableChunk(caption: string, headers: string[], rows: string[][]): string {
  const headerLine = headers.length > 0 ? headers.join(" | ") : "(헤더 없음)";
  const body = rows.map((r) => r.join(" | ")).join("\n");
  return [`표 캡션: ${caption}`, `컬럼: ${headerLine}`, body].filter(Boolean).join("\n\n");
}

describe("token-aware chunk split", () => {
  it("keeps short body as a single passage under target", async () => {
    const pieces = await splitBodyContentByTokens({
      content: "짧은 본문입니다.",
      title: "제목",
      section: "섹션",
      tags: ["tag"],
      countTokens: denseCounter,
      targetPassageTokens: 448,
      maxSequenceTokens: 512,
    });
    assert.equal(pieces.length, 1);
    assert.ok(pieces[0]!.tokenCount <= 448);
    assert.equal(pieces[0]!.splitCount, 1);
  });

  it("splits long Korean paragraphs so every passage stays within target", async () => {
    const paragraph = Array.from({ length: 40 }, (_, i) => `문단 ${i + 1}. 한글 검색 단위 본문입니다.`).join(
      "\n\n",
    );
    const pieces = await splitBodyContentByTokens({
      content: paragraph,
      title: "긴 문서",
      section: "본문",
      tags: ["감리"],
      countTokens: denseCounter,
      targetPassageTokens: 448,
      maxSequenceTokens: 512,
      overlapTokens: 48,
    });
    assert.ok(pieces.length >= 2);
    for (const piece of pieces) {
      assert.ok(piece.tokenCount <= 448, `tokenCount ${piece.tokenCount}`);
      const passage = buildPassageEmbeddingText({
        title: "긴 문서",
        section: "본문",
        tags: ["감리"],
        content: piece.content,
      });
      assert.ok(passage.startsWith("passage:"));
    }
    // Order preserved: first piece mentions 문단 1, last mentions a later paragraph.
    assert.match(pieces[0]!.content, /문단 1/);
  });

  it("splits tables by token budget with repeated headers", async () => {
    const rows = Array.from({ length: 30 }, (_, i) => [`행${i + 1}`, `값${i + 1} `.repeat(20).trim()]);
    const pieces = await splitTableRowsByTokens({
      caption: "점검표",
      headers: ["항목", "내용"],
      rows,
      title: "표 제목",
      countTokens: denseCounter,
      formatTableChunk,
      targetPassageTokens: 448,
      maxSequenceTokens: 512,
    });
    assert.ok(pieces.length >= 2);
    for (const piece of pieces) {
      assert.ok(piece.tokenCount <= 448);
      assert.match(piece.content, /컬럼:/);
      assert.match(piece.content, /항목/);
    }
  });

  it("token gate PASS when all within target", async () => {
    const passages = ["passage: short a", "passage: short b"];
    const summary = await evaluatePassageTokenGate({
      passages,
      countTokens: denseCounter,
      model: "dragonkue/multilingual-e5-small-ko-v2",
      revision: "fcfc26bf355882620c48df58be112275bd756f50",
    });
    assert.equal(passageTokenGateStatus(summary), "PASS");
    assert.equal(summary.hardLimitExceededCount, 0);
  });

  it("token gate FAIL when hard limit exceeded", async () => {
    const huge = "passage: " + "가".repeat(2000);
    const summary = await evaluatePassageTokenGate({
      passages: [huge],
      countTokens: denseCounter,
      model: "m",
      revision: "r",
    });
    assert.equal(passageTokenGateStatus(summary), "FAIL");
    assert.ok(summary.hardLimitExceededCount >= 1);
  });
});

describe("typed embedding error preservation", () => {
  it("maps EMBEDDING_TOKEN_LIMIT_EXCEEDED to structure guidance", async () => {
    const { mapSearchDataFailureCode } = await import("@/lib/search-data/search-data-error");
    const g = mapSearchDataFailureCode("EMBEDDING_TOKEN_LIMIT_EXCEEDED");
    assert.equal(g.preferStructure, true);
    assert.match(g.message, /구조화/);
  });
});
