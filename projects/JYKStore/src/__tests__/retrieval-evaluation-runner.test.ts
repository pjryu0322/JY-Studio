import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateCaseStatus,
  aggregateRetrievalEvaluationResults,
  canRunAdminRetrievalEvaluationForStatus,
  computeModeMetric,
  evaluateRetrievalCaseAgainstCandidates,
} from "@/lib/retrieval-evaluation/retrieval-evaluation-runner";
import type {
  RetrievalEvaluationCandidate,
  RetrievalEvaluationCaseInput,
  RetrievalEvaluationCaseResultDraft,
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

function draft(
  overrides: Partial<RetrievalEvaluationCaseResultDraft>,
): RetrievalEvaluationCaseResultDraft {
  return {
    caseId: "case-1",
    retrievalMode: "keyword",
    query: "q",
    status: "PASS",
    topK: 5,
    hit: true,
    firstHitRank: 1,
    reciprocalRank: 1,
    bestScore: 10,
    matchedChunkIds: ["chunk-1"],
    matchedSourceIds: [],
    returnedChunkIds: ["chunk-1"],
    returnedSourceIds: [],
    issueCodes: [],
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

  it("separates case counts from result counts for mixed modes", () => {
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
    assert.equal(agg.totalCaseCount, 2);
    assert.equal(agg.evaluatedCaseCount, 2);
    assert.equal(agg.evaluatedResultCount, 4);
    assert.equal(agg.failCaseCount, 1);
    assert.equal(agg.passCaseCount, 1);
    assert.ok(agg.caseHitRate === 0.5);
    assert.ok(agg.resultHitRate === 0.5);
    assert.equal(agg.status, "FAIL");
  });

  it("treats keyword PASS + hybrid FAIL as case WARNING with divergence", () => {
    const status = aggregateCaseStatus([
      draft({ retrievalMode: "keyword", status: "PASS", hit: true }),
      draft({
        retrievalMode: "hybrid",
        status: "FAIL",
        hit: false,
        firstHitRank: null,
        reciprocalRank: 0,
      }),
    ]);
    assert.equal(status.status, "WARNING");
    assert.equal(status.hasModeDivergence, true);
  });

  it("marks case FAIL when both modes FAIL", () => {
    const status = aggregateCaseStatus([
      draft({
        retrievalMode: "keyword",
        status: "FAIL",
        hit: false,
        reciprocalRank: 0,
      }),
      draft({
        retrievalMode: "hybrid",
        status: "FAIL",
        hit: false,
        reciprocalRank: 0,
      }),
    ]);
    assert.equal(status.status, "FAIL");
  });

  it("computes mode metrics for keyword and hybrid", () => {
    const results = [
      draft({ retrievalMode: "keyword", status: "PASS", hit: true, reciprocalRank: 1 }),
      draft({
        retrievalMode: "keyword",
        caseId: "c2",
        status: "FAIL",
        hit: false,
        reciprocalRank: 0,
      }),
      draft({ retrievalMode: "hybrid", status: "WARNING", hit: true, reciprocalRank: 0.25 }),
    ];
    const keyword = computeModeMetric(results.filter((r) => r.retrievalMode === "keyword"));
    const hybrid = computeModeMetric(results.filter((r) => r.retrievalMode === "hybrid"));
    assert.equal(keyword.passCount, 1);
    assert.equal(keyword.failCount, 1);
    assert.equal(keyword.hitRate, 0.5);
    assert.equal(hybrid.warningCount, 1);
    assert.equal(hybrid.hitRate, 1);
  });

  it("restricts admin retrieval evaluation to DRAFT/REVIEWING", () => {
    assert.equal(canRunAdminRetrievalEvaluationForStatus("DRAFT"), true);
    assert.equal(canRunAdminRetrievalEvaluationForStatus("REVIEWING"), true);
    assert.equal(canRunAdminRetrievalEvaluationForStatus("PUBLISHED"), false);
    assert.equal(canRunAdminRetrievalEvaluationForStatus("VERIFIED"), false);
  });
});
