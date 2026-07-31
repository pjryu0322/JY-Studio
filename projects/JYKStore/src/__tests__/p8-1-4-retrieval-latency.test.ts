import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  NEAR_DUPLICATE_COMPARE_CAP,
  RETRIEVAL_RANKING_POLICY_VERSION,
  deduplicateScoredCandidates,
} from "@/lib/retrieval/relevance-diversity-rerank";
import type { ScoredCandidate } from "@/lib/retrieval/retrieval-types";

function fakeCandidate(id: string, content: string, score: number): ScoredCandidate {
  const now = new Date();
  return {
    chunk: {
      id,
      packId: "p",
      versionId: "v",
      sourceDocumentId: null,
      title: id,
      section: null,
      content,
      tags: [],
      metadata: {},
      sortOrder: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      sourceDocument: null,
    } as ScoredCandidate["chunk"],
    score,
    keywordScore: score,
    metadataScore: 0,
    vectorScore: 0,
    vectorSimilarity: 0,
    matchReasons: [],
    metadataRecord: null,
  };
}

describe("P8.1.4 retrieval latency hardening", () => {
  it("caps expensive near-duplicate compares and bumps ranking policy", () => {
    assert.ok(NEAR_DUPLICATE_COMPARE_CAP >= 50);
    assert.equal(RETRIEVAL_RANKING_POLICY_VERSION, "relevance_diversity_v3");
  });

  it("dedupes exact bodies quickly across a large pool", () => {
    const body =
      "SpanMergingField merges adjacent cells with identical values into one visual region for grid display. ".repeat(
        4,
      );
    const scored = Array.from({ length: 200 }, (_, i) =>
      fakeCandidate(`c${i}`, i % 3 === 0 ? body : `${body} variant ${i}`, 100 - i * 0.1),
    );
    const started = Date.now();
    const { kept, removedCount } = deduplicateScoredCandidates(scored);
    const elapsed = Date.now() - started;
    assert.ok(removedCount >= 50);
    assert.ok(kept.length < scored.length);
    assert.ok(elapsed < 2000, `dedupe too slow: ${elapsed}ms`);
  });

  it("lexical collect selects slim sourceDocument fields", () => {
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "..",
        "lib",
        "retrieval",
        "retrieval-candidate-store.ts",
      ),
      "utf8",
    );
    assert.ok(source.includes("sourceDocument: { select: { id: true, title: true } }"));
  });
});
