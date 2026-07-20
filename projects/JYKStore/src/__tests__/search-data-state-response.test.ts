import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSearchDataStatusResponse,
  type SearchDataStatusInput,
} from "../lib/search-data/search-data-state.ts";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "../lib/retrieval/relevance-diversity-rerank.ts";

function base(overrides: Partial<SearchDataStatusInput> = {}): SearchDataStatusInput {
  return {
    structurePassed: true,
    pipelineCurrent: true,
    packStatusIsDraft: true,
    chunkCount: 10,
    generation: null,
    vectorCount: 0,
    ...overrides,
  };
}

const e5Ready = {
  id: "g1",
  status: "READY",
  scope: "DRAFT",
  embeddingProvider: "local-e5",
  embeddingModel: "org/model-name",
  embeddingModelRevision: "abc",
  embeddingDimension: 384,
  chunkCount: 10,
  embeddedCount: 10,
  failedCount: 0,
  chunkGenerationId: "g1",
  pipelineRunId: "run1",
  normalizedDocumentId: "nd1",
  fingerprint: "fp1",
  attempt: 1,
};

describe("search-data-state response assembler", () => {
  it("preserves response keys and CTA flags for CREATED", () => {
    const res = buildSearchDataStatusResponse(
      base({
        generation: { ...e5Ready, status: "INDEXING" },
        vectorCount: 10,
      }),
    );
    assert.equal(res.state, "CREATED");
    assert.equal(res.canGenerate, false);
    assert.equal(res.canValidate, true);
    assert.equal(res.canRunServiceValidation, false);
    assert.equal(res.message, "검색데이터 생성이 완료되었습니다.");
    assert.equal(res.modelLabel, "model-name");
    assert.equal(res.currentRankingPolicyVersion, RETRIEVAL_RANKING_POLICY_VERSION);
    assert.ok(res.technical);
    assert.equal(res.technical?.searchIndexGenerationId, "g1");
  });

  it("keeps VALIDATION_FAILED validate CTA and message", () => {
    const res = buildSearchDataStatusResponse(
      base({
        generation: e5Ready,
        vectorCount: 10,
        evaluationStepStatus: "FAIL",
        evaluationTotalCases: 4,
        evaluationPassedCases: 1,
      }),
    );
    assert.equal(res.state, "VALIDATION_FAILED");
    assert.equal(res.canValidate, true);
    assert.equal(res.canGenerate, true);
    assert.equal(res.message, "검색 품질이 기준을 충족하지 못했습니다.");
    assert.equal(res.validationSummary?.status, "FAIL");
  });

  it("blocks validate before creation", () => {
    const res = buildSearchDataStatusResponse(base());
    assert.equal(res.state, "NOT_CREATED");
    assert.equal(res.canValidate, false);
    assert.equal(res.canGenerate, true);
    assert.equal(res.message, "현재 구조화 결과로 생성된 검색데이터가 없습니다.");
  });

  it("marks ranking policy stale on VALIDATED with outdated version", () => {
    const res = buildSearchDataStatusResponse(
      base({
        generation: e5Ready,
        vectorCount: 10,
        evaluationStepStatus: "PASS",
        evaluationTotalCases: 2,
        evaluationPassedCases: 2,
        evaluationRankingPolicyVersion: "old-policy",
      }),
    );
    assert.equal(res.state, "VALIDATED");
    assert.equal(res.rankingPolicyStale, true);
    assert.equal(res.canValidate, true);
    assert.equal(res.canRunServiceValidation, false);
    assert.match(res.message ?? "", /검색 순위 정책이 변경/);
  });
});
