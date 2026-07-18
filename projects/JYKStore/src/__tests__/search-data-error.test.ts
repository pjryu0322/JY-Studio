import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapSearchDataFailureCode } from "../lib/search-data/search-data-error.ts";
import {
  buildSearchDataStatusResponse,
  computeSearchDataUiState,
  searchDataTabStatusLabel,
  type SearchDataStatusInput,
} from "../lib/search-data/search-data-state.ts";

describe("mapSearchDataFailureCode", () => {
  it("maps SEARCH_RUNTIME_UNAVAILABLE to admin support", () => {
    const g = mapSearchDataFailureCode("SEARCH_RUNTIME_UNAVAILABLE");
    assert.match(g.message, /관리자에게 문의/);
    assert.equal(g.retryable, false);
    assert.equal(g.supportRequired, true);
    assert.doesNotMatch(g.message, /잠시 후 다시 시도/);
  });

  it("maps EMBEDDING_MODEL_REVISION_MISMATCH to admin support", () => {
    const g = mapSearchDataFailureCode("EMBEDDING_MODEL_REVISION_MISMATCH");
    assert.match(g.message, /관리자에게 문의/);
    assert.equal(g.supportRequired, true);
  });

  it("maps EMBEDDING_TOKEN_LIMIT_EXCEEDED to structure guidance", () => {
    const g = mapSearchDataFailureCode("EMBEDDING_TOKEN_LIMIT_EXCEEDED");
    assert.match(g.message, /데이터 구조화/);
    assert.equal(g.preferStructure, true);
  });

  it("maps VECTOR_COUNT_MISMATCH to regenerate", () => {
    const g = mapSearchDataFailureCode("VECTOR_COUNT_MISMATCH");
    assert.match(g.message, /다시 생성/);
    assert.equal(g.retryable, true);
  });

  it("maps TRANSIENT_DB_ERROR to retry later", () => {
    const g = mapSearchDataFailureCode("TRANSIENT_DB_ERROR");
    assert.match(g.message, /잠시 후 다시 시도/);
    assert.equal(g.retryable, true);
  });
});

const e5Gen = {
  id: "g1",
  status: "INDEXING",
  scope: "DRAFT",
  embeddingProvider: "local-e5",
  embeddingModel: "dragonkue/multilingual-e5-small-ko-v2",
  embeddingModelRevision: "fcfc26bf355882620c48df58be112275bd756f50",
  embeddingDimension: 384,
  chunkCount: 86,
  embeddedCount: 86,
  failedCount: 0,
  chunkGenerationId: "g1",
  pipelineRunId: "run1",
  normalizedDocumentId: "nd1",
  fingerprint: "fp1",
  attempt: 2,
  failureCode: null as string | null,
  failureMessage: null as string | null,
};

function base(overrides: Partial<SearchDataStatusInput> = {}): SearchDataStatusInput {
  return {
    structurePassed: true,
    pipelineCurrent: true,
    packStatusIsDraft: true,
    chunkCount: 86,
    generation: null,
    vectorCount: 0,
    ...overrides,
  };
}

describe("search-data state hardening", () => {
  it("keeps VALIDATION_FAILED when evaluation FAIL and generation INDEXING", () => {
    assert.equal(
      computeSearchDataUiState(
        base({
          generation: { ...e5Gen, status: "INDEXING" },
          vectorCount: 86,
          evaluationStepStatus: "FAIL",
        }),
      ),
      "VALIDATION_FAILED",
    );
  });

  it("keeps VALIDATION_FAILED for WARNING", () => {
    assert.equal(
      computeSearchDataUiState(
        base({
          generation: { ...e5Gen, status: "INDEXING" },
          vectorCount: 86,
          evaluationStepStatus: "WARNING",
        }),
      ),
      "VALIDATION_FAILED",
    );
  });

  it("prefers CREATE_FAILED when generation is FAILED even if eval FAIL", () => {
    assert.equal(
      computeSearchDataUiState(
        base({
          generation: {
            ...e5Gen,
            status: "FAILED",
            failureCode: "SEARCH_RUNTIME_UNAVAILABLE",
          },
          evaluationStepStatus: "FAIL",
        }),
      ),
      "CREATE_FAILED",
    );
  });

  it("surfaces mapped failure message and codes on CREATE_FAILED", () => {
    const res = buildSearchDataStatusResponse(
      base({
        generation: {
          ...e5Gen,
          status: "FAILED",
          failureCode: "SEARCH_RUNTIME_UNAVAILABLE",
          failureMessage: "internal",
        },
      }),
    );
    assert.equal(res.state, "CREATE_FAILED");
    assert.equal(res.failureCode, "SEARCH_RUNTIME_UNAVAILABLE");
    assert.match(res.message ?? "", /관리자에게 문의/);
    assert.equal(res.supportRequired, true);
    assert.equal(res.retryable, false);
  });

  it("maps tab status labels", () => {
    assert.equal(searchDataTabStatusLabel("NOT_CREATED"), "시작 전");
    assert.equal(searchDataTabStatusLabel("CREATING"), "진행 중");
    assert.equal(searchDataTabStatusLabel("CREATE_FAILED"), "보완 필요");
    assert.equal(searchDataTabStatusLabel("CREATED"), "검증 필요");
    assert.equal(searchDataTabStatusLabel("VALIDATED"), "완료");
  });

  it("allows re-validate on VALIDATION_FAILED", () => {
    const res = buildSearchDataStatusResponse(
      base({
        generation: { ...e5Gen, status: "INDEXING" },
        vectorCount: 86,
        evaluationStepStatus: "FAIL",
      }),
    );
    assert.equal(res.state, "VALIDATION_FAILED");
    assert.equal(res.canValidate, true);
    assert.equal(res.canGenerate, true);
  });
});
