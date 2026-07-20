import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canGenerateSearchData,
  canValidateSearchDataState,
  computeSearchDataUiState,
  isLocalE5Complete,
  isRunningGeneration,
  isScaffoldGeneration,
  type SearchDataStatusInput,
} from "../lib/search-data/search-data-state.ts";

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
  embeddingModel: "org/model",
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

describe("search-data-state policy", () => {
  it("maps core creation states", () => {
    assert.equal(computeSearchDataUiState(base()), "NOT_CREATED");
    assert.equal(
      computeSearchDataUiState(
        base({
          generation: { ...e5Ready, status: "EMBEDDING", embeddedCount: 3 },
          vectorCount: 3,
        }),
      ),
      "CREATING",
    );
    assert.equal(
      computeSearchDataUiState(
        base({
          generation: {
            ...e5Ready,
            status: "FAILED",
            failureCode: "INDEX_BUILD_FAILED",
            embeddedCount: 0,
          },
        }),
      ),
      "CREATE_FAILED",
    );
    assert.equal(
      computeSearchDataUiState(
        base({
          generation: e5Ready,
          vectorCount: 10,
          evaluationStepStatus: "PASS",
          evaluationTotalCases: 5,
          evaluationPassedCases: 5,
        }),
      ),
      "VALIDATED",
    );
    assert.equal(
      computeSearchDataUiState(
        base({
          generation: e5Ready,
          vectorCount: 10,
          evaluationStepStatus: "FAIL",
        }),
      ),
      "VALIDATION_FAILED",
    );
  });

  it("treats binding stale as STALE not CREATE_FAILED", () => {
    assert.equal(
      computeSearchDataUiState(
        base({
          generation: {
            ...e5Ready,
            status: "FAILED",
            failureCode: "SEARCH_DATA_BINDING_STALE",
          },
        }),
      ),
      "STALE",
    );
  });

  it("detects scaffold vs running generations", () => {
    assert.equal(
      isScaffoldGeneration({ ...e5Ready, status: "PENDING", attempt: 0 }),
      true,
    );
    assert.equal(
      isRunningGeneration({ ...e5Ready, status: "PENDING", attempt: 1 }),
      true,
    );
    assert.equal(
      isRunningGeneration({ ...e5Ready, status: "PENDING", attempt: 0 }),
      false,
    );
  });

  it("allows validate on CREATED and VALIDATION_FAILED when Local E5 complete", () => {
    const complete = base({ generation: e5Ready, vectorCount: 10 });
    assert.equal(isLocalE5Complete(complete), true);
    assert.equal(
      canValidateSearchDataState({
        packStatusIsDraft: true,
        state: "CREATED",
        rankingPolicyStale: false,
        localE5Complete: true,
      }),
      true,
    );
    assert.equal(
      canValidateSearchDataState({
        packStatusIsDraft: true,
        state: "VALIDATION_FAILED",
        rankingPolicyStale: false,
        localE5Complete: true,
      }),
      true,
    );
    assert.equal(
      canValidateSearchDataState({
        packStatusIsDraft: true,
        state: "NOT_CREATED",
        rankingPolicyStale: false,
        localE5Complete: false,
      }),
      false,
    );
  });

  it("allows generate only for draft + ready structure states", () => {
    assert.equal(
      canGenerateSearchData({
        packStatusIsDraft: true,
        structurePassed: true,
        pipelineCurrent: true,
        state: "NOT_CREATED",
      }),
      true,
    );
    assert.equal(
      canGenerateSearchData({
        packStatusIsDraft: true,
        structurePassed: true,
        pipelineCurrent: true,
        state: "CREATED",
      }),
      false,
    );
  });
});
