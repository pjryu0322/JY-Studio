import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { buildPassageEmbeddingText } from "@/lib/embedding/e5-embedding-text";
import type { PassageTokenCounter } from "@/lib/embedding/e5-tokenize-client";
import {
  assertPrimaryContentCoverage,
  evaluatePassageTokenGate,
  passageTokenGateStatus,
  splitBodyContentByTokens,
  splitTableRowsByTokens,
} from "@/lib/docling-knowledge/token-aware-chunk-split";
import {
  isSearchFoundationStagesPassed,
  isStructureStagesPassed,
} from "@/lib/docling-knowledge/docling-knowledge-stage-pass";

/** Deterministic fake tokenizer: ~2 chars/token to stress Korean-like density. */
const denseCounter: PassageTokenCounter = async (texts) =>
  texts.map((t) => Math.max(1, Math.ceil(t.trim().length / 2)));

function formatTableChunk(caption: string, headers: string[], rows: string[][]): string {
  const headerLine = headers.length > 0 ? headers.join(" | ") : "(헤더 없음)";
  const body = rows.map((r) => r.join(" | ")).join("\n");
  return [`표 캡션: ${caption}`, `컬럼: ${headerLine}`, body].filter(Boolean).join("\n\n");
}

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

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
    assert.match(pieces[0]!.content, /문단 1/);
    const coverage = assertPrimaryContentCoverage({ sourceText: paragraph, pieces });
    assert.equal(coverage.ok, true);
  });

  it("preserves English and mixed language primary content", async () => {
    const english = Array.from({ length: 50 }, (_, i) => `Sentence ${i + 1}. Safety inspection checklist item.`).join(
      " ",
    );
    const mixed = `한글 서론. ${english} 마무리 문장입니다.`;
    for (const source of [english, mixed]) {
      const pieces = await splitBodyContentByTokens({
        content: source,
        title: "Mixed Doc",
        countTokens: denseCounter,
        targetPassageTokens: 448,
        maxSequenceTokens: 512,
        overlapTokens: 48,
      });
      assert.ok(pieces.length >= 1);
      const coverage = assertPrimaryContentCoverage({ sourceText: source, pieces });
      assert.equal(coverage.ok, true, coverage.ok ? "" : coverage.message);
    }
  });

  it("records accurate overlap provenance metadata", async () => {
    const paragraph = Array.from({ length: 60 }, (_, i) => `문단 ${i + 1}. 중첩 검증용 본문입니다.`).join("\n\n");
    const pieces = await splitBodyContentByTokens({
      content: paragraph,
      title: "Overlap",
      countTokens: denseCounter,
      targetPassageTokens: 448,
      maxSequenceTokens: 512,
      overlapTokens: 48,
    });
    assert.ok(pieces.length >= 2);
    const second = pieces[1]!;
    assert.ok(second.actualOverlapTokens <= 48);
    assert.equal(second.configuredOverlapTokens, 48);
    if (second.hasOverlap) {
      assert.ok(second.overlapSourceTextStart != null);
      assert.ok(second.overlapSourceTextEnd != null);
      assert.ok(second.overlapSourceTextEnd! > second.overlapSourceTextStart!);
    }
    for (let i = 1; i < pieces.length; i++) {
      assert.ok(
        pieces[i]!.primarySourceTextStart >= pieces[i - 1]!.primarySourceTextEnd,
        "primary ranges must not overlap",
      );
    }
    const coverage = assertPrimaryContentCoverage({ sourceText: paragraph, pieces });
    assert.equal(coverage.ok, true);
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

  it("preserves column structure when a single cell exceeds the budget", async () => {
    const longCell = Array.from({ length: 200 }, (_, i) => `설명조각${i + 1}`).join(" ");
    const pieces = await splitTableRowsByTokens({
      caption: "긴 셀",
      headers: ["항목", "설명", "기준"],
      rows: [["A-1", longCell, "적합"]],
      title: "표",
      countTokens: denseCounter,
      formatTableChunk,
      targetPassageTokens: 448,
      maxSequenceTokens: 512,
    });
    assert.ok(pieces.length >= 2);
    const joinedCell = pieces
      .map((p) => String(p.primaryContent ?? ""))
      .join("")
      .replace(/\s+/g, "");
    assert.ok(joinedCell.includes("설명조각1"));
    assert.ok(joinedCell.includes("설명조각200"));
    assert.equal(joinedCell, longCell.replace(/\s+/g, ""));
    for (const piece of pieces) {
      assert.ok(piece.tokenCount <= 448);
      assert.match(piece.content, /컬럼: 항목/);
      assert.match(piece.content, /A-1/);
      assert.match(piece.content, /적합/);
      assert.equal((piece.tableMeta?.tableHeaders as string[]).length, 3);
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

  it("token gate WARNING when only target exceeded", async () => {
    const mid = "passage: " + "가".repeat(900);
    const summary = await evaluatePassageTokenGate({
      passages: [mid],
      countTokens: denseCounter,
      targetPassageTokens: 448,
      maxSequenceTokens: 512,
      model: "m",
      revision: "r",
    });
    // denseCounter: 900/2 = 450 → WARNING (between 448 and 512)
    assert.equal(passageTokenGateStatus(summary), "WARNING");
  });
});

describe("structure pass requires Token Gate PASS", () => {
  it("rejects WARNING tokenGateStatus for structure completion", () => {
    const steps = [
      { step: "STRUCTURE_VALIDATING", status: "PASS" },
      { step: "KNOWLEDGE_CHECKING", status: "PASS" },
      {
        step: "CHUNKING",
        status: "PASS",
        details: { chunkCount: 2, tokenGateStatus: "WARNING", targetExceededCount: 1 },
      },
    ];
    assert.equal(isStructureStagesPassed({ steps, pipelineCurrent: true }), false);
  });

  it("accepts PASS tokenGateStatus", () => {
    const steps = [
      { step: "STRUCTURE_VALIDATING", status: "PASS" },
      { step: "KNOWLEDGE_CHECKING", status: "PASS" },
      {
        step: "CHUNKING",
        status: "PASS",
        details: { chunkCount: 2, tokenGateStatus: "PASS", hardLimitExceededCount: 0 },
      },
    ];
    assert.equal(isStructureStagesPassed({ steps, pipelineCurrent: true }), true);
    assert.equal(isSearchFoundationStagesPassed({ steps, pipelineCurrent: true }), false);
  });
});

describe("pipeline ownership boundary (static)", () => {
  it("forbids shrunk[0]-only save and structure-side embedding", () => {
    const builder = readFileSync(
      join(projectRoot, "src/lib/docling-knowledge/docling-nd-retrieval-chunk-builder.ts"),
      "utf8",
    );
    const pipeline = readFileSync(
      join(projectRoot, "src/lib/docling-knowledge/docling-knowledge-pipeline-service.ts"),
      "utf8",
    );
    const worker = [
      readFileSync(
        join(projectRoot, "src/lib/search-data/search-data-generation-worker.ts"),
        "utf8",
      ),
      readFileSync(
        join(projectRoot, "src/lib/search-data/search-data-generation-process.ts"),
        "utf8",
      ),
      readFileSync(
        join(projectRoot, "src/lib/search-data/search-data-generation-process-embed.ts"),
        "utf8",
      ),
    ].join("\n");
    assert.ok(!builder.includes("shrunk[0]"));
    assert.ok(builder.includes("assertPrimaryContentCoverage"));
    assert.ok(!pipeline.includes("rebuildPackEmbeddings"));
    assert.ok(!pipeline.includes("runDoclingRetrievalEvaluation"));
    // P7.6: TS doc/chunk embedding generation removed everywhere — the legacy
    // worker embed step is fail-closed (Python Worker owns embeddings.json).
    assert.ok(!worker.includes("rebuildPackEmbeddings"));
    assert.ok(worker.includes("LEGACY_BUILDER_DISABLED"));
    assert.ok(worker.includes("attempt > 0"));
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

describe("source-change STALE readiness", () => {
  it("non-current binding blocks structure and search foundation", () => {
    const steps = [
      { step: "STRUCTURE_VALIDATING", status: "PASS" },
      { step: "KNOWLEDGE_CHECKING", status: "PASS" },
      { step: "CHUNKING", status: "PASS", details: { chunkCount: 5, tokenGateStatus: "PASS" } },
      { step: "INDEXING", status: "PASS" },
      { step: "SEARCH_EVALUATING", status: "PASS" },
      { step: "READY_FOR_REVIEW", status: "PASS" },
    ];
    assert.equal(isStructureStagesPassed({ steps, pipelineCurrent: false }), false);
    assert.equal(isSearchFoundationStagesPassed({ steps, pipelineCurrent: false }), false);
  });
});
