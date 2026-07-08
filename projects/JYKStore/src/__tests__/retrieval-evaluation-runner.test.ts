import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateRetrievalEvaluationResults,
  evaluateRetrievalCaseAgainstCandidates,
} from "@/lib/retrieval-evaluation/retrieval-evaluation-runner";
import type {
  RetrievalEvaluationCandidate,
  RetrievalEvaluationCaseInput,
} from "@/lib/retrieval-evaluation/retrieval-evaluation-types";

function baseCase(
  overrides: Partial<RetrievalEvaluationCaseInput> = {},
): RetrievalEvaluationCaseInput {
  return {
    id: "case-1",
    query: "auth request",
    mode: "both",
    topK: 5,
    expectedChunkIds: ["chunk-1"],
    expectedSourceDocumentIds: [],
    expectedSections: [],
    expectedTags: [],
    expectedMetadata: null,
    weight: 1,
    ...overrides,
  };
}

function candidate(
  overrides: Partial<RetrievalEvaluationCandidate> = {},
): RetrievalEvaluationCandidate {
  return {
    chunkId: "chunk-1",
    sourceDocumentId: "doc-1",
    title: "Auth",
    section: "auth",
    tags: ["auth"],
    metadata: null,
    score: 10,
    ...overrides,
  };
}

describe("retrieval evaluation runner", () => {
  it("marks PASS when expectedChunkIds hit in top 3", () => {
    const result = evaluateRetrievalCaseAgainstCandidates({
      caseInput: baseCase(),
      retrievalMode: "keyword",
      candidates: [candidate(), candidate({ chunkId: "other", score: 5 })],
    });
    assert.equal(result.hit, true);
    assert.equal(result.status, "PASS");
    assert.equal(result.firstHitRank, 1);
    assert.equal(result.reciprocalRank, 1);
  });

  it("marks PASS when expectedSourceDocumentIds hit", () => {
    const result = evaluateRetrievalCaseAgainstCandidates({
      caseInput: baseCase({
        expectedChunkIds: [],
        expectedSourceDocumentIds: ["doc-1"],
      }),
      retrievalMode: "hybrid",
      candidates: [candidate({ chunkId: "x" })],
    });
    assert.equal(result.hit, true);
    assert.equal(result.status, "PASS");
  });

  it("marks WARNING when firstHitRank is greater than 3", () => {
    const result = evaluateRetrievalCaseAgainstCandidates({
      caseInput: baseCase({ topK: 5 }),
      retrievalMode: "keyword",
      candidates: [
        candidate({ chunkId: "a", score: 9 }),
        candidate({ chunkId: "b", score: 8 }),
        candidate({ chunkId: "c", score: 7 }),
        candidate({ chunkId: "chunk-1", score: 6 }),
      ],
    });
    assert.equal(result.hit, true);
    assert.equal(result.firstHitRank, 4);
    assert.equal(result.status, "WARNING");
  });

  it("marks FAIL when there is no hit", () => {
    const result = evaluateRetrievalCaseAgainstCandidates({
      caseInput: baseCase(),
      retrievalMode: "keyword",
      candidates: [candidate({ chunkId: "nope", sourceDocumentId: "other" })],
    });
    assert.equal(result.hit, false);
    assert.equal(result.status, "FAIL");
    assert.equal(result.reciprocalRank, 0);
  });

  it("aggregates hitRate MRR totalScore and mixed results", () => {
    const cases = [
      baseCase({ id: "c1" }),
      baseCase({ id: "c2", expectedChunkIds: ["missing"] }),
    ];
    const results = [
      evaluateRetrievalCaseAgainstCandidates({
        caseInput: cases[0]!,
        retrievalMode: "keyword",
        candidates: [candidate()],
      }),
      evaluateRetrievalCaseAgainstCandidates({
        caseInput: cases[0]!,
        retrievalMode: "hybrid",
        candidates: [candidate()],
      }),
      evaluateRetrievalCaseAgainstCandidates({
        caseInput: cases[1]!,
        retrievalMode: "keyword",
        candidates: [candidate()],
      }),
      evaluateRetrievalCaseAgainstCandidates({
        caseInput: cases[1]!,
        retrievalMode: "hybrid",
        candidates: [candidate()],
      }),
    ];
    const agg = aggregateRetrievalEvaluationResults({ cases, results });
    assert.equal(agg.retrievalMode, "mixed");
    assert.equal(agg.evaluatedCaseCount, 4);
    assert.ok(agg.hitRate === 0.5);
    assert.ok(agg.meanReciprocalRank > 0);
    assert.ok(agg.totalScore >= 0 && agg.totalScore <= 100);
    assert.equal(agg.status, "FAIL");
  });
});
