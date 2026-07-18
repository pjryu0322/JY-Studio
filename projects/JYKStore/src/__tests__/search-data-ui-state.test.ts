import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSearchDataStatusResponse,
  computeSearchDataUiState,
  type SearchDataStatusInput,
} from "../lib/search-data/search-data-state.ts";

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
};

describe("computeSearchDataUiState", () => {
  it("returns NOT_CREATED when structure is ready but no Local E5 generation", () => {
    assert.equal(computeSearchDataUiState(base()), "NOT_CREATED");
  });

  it("ignores legacy local-hash and stays NOT_CREATED", () => {
    assert.equal(
      computeSearchDataUiState(
        base({
          generation: {
            ...e5Gen,
            embeddingProvider: "local-hash",
            embeddingDimension: 256,
            status: "READY",
          },
          vectorCount: 86,
          indexingStepStatus: "PASS",
          legacyLocalHashPresent: true,
        }),
      ),
      "NOT_CREATED",
    );
  });

  it("returns CREATING while embedding", () => {
    assert.equal(
      computeSearchDataUiState(
        base({
          generation: { ...e5Gen, status: "EMBEDDING", attempt: 1, embeddedCount: 34 },
          vectorCount: 34,
        }),
      ),
      "CREATING",
    );
  });

  it("shows scaffold PENDING attempt=0 as NOT_CREATED", () => {
    assert.equal(
      computeSearchDataUiState(
        base({
          generation: {
            ...e5Gen,
            status: "PENDING",
            attempt: 0,
            embeddedCount: 0,
            failedCount: 0,
          },
          vectorCount: 0,
        }),
      ),
      "NOT_CREATED",
    );
  });

  it("treats PENDING with undefined attempt as scaffold", () => {
    assert.equal(
      computeSearchDataUiState(
        base({
          generation: {
            ...e5Gen,
            status: "PENDING",
            attempt: undefined,
            embeddedCount: 0,
          },
          vectorCount: 0,
        }),
      ),
      "NOT_CREATED",
    );
  });

  it("shows enqueued PENDING attempt=1 as CREATING", () => {
    assert.equal(
      computeSearchDataUiState(
        base({
          generation: {
            ...e5Gen,
            status: "PENDING",
            attempt: 1,
            embeddedCount: 0,
          },
          vectorCount: 0,
        }),
      ),
      "CREATING",
    );
  });

  it("returns CREATE_FAILED on FAILED generation", () => {
    assert.equal(
      computeSearchDataUiState(
        base({ generation: { ...e5Gen, status: "FAILED" } }),
      ),
      "CREATE_FAILED",
    );
  });

  it("returns CREATED when Local E5 counts match and not yet READY eval", () => {
    assert.equal(
      computeSearchDataUiState(
        base({
          generation: { ...e5Gen, status: "INDEXING" },
          vectorCount: 86,
        }),
      ),
      "CREATED",
    );
  });

  it("returns VALIDATED when READY and evaluation PASS", () => {
    assert.equal(
      computeSearchDataUiState(
        base({
          generation: { ...e5Gen, status: "READY" },
          vectorCount: 86,
          evaluationStepStatus: "PASS",
          evaluationTotalCases: 5,
          evaluationPassedCases: 5,
        }),
      ),
      "VALIDATED",
    );
  });

  it("returns STALE when binding is not current", () => {
    assert.equal(
      computeSearchDataUiState(base({ pipelineCurrent: false })),
      "STALE",
    );
  });

  it("vector count mismatch prevents CREATED", () => {
    assert.equal(
      computeSearchDataUiState(
        base({
          generation: { ...e5Gen, status: "INDEXING" },
          vectorCount: 80,
        }),
      ),
      "CREATE_FAILED",
    );
  });
});

describe("buildSearchDataStatusResponse", () => {
  it("exposes generate CTA for NOT_CREATED and locks service validation", () => {
    const dto = buildSearchDataStatusResponse(base());
    assert.equal(dto.state, "NOT_CREATED");
    assert.equal(dto.canGenerate, true);
    assert.equal(dto.canValidate, false);
    assert.equal(dto.canRunServiceValidation, false);
  });

  it("shows scaffold as NOT_CREATED and enables generation", () => {
    const dto = buildSearchDataStatusResponse(
      base({
        generation: {
          ...e5Gen,
          status: "PENDING",
          attempt: 0,
          embeddedCount: 0,
          failedCount: 0,
        },
        vectorCount: 0,
      }),
    );
    assert.equal(dto.state, "NOT_CREATED");
    assert.equal(dto.canGenerate, true);
    assert.equal(dto.canValidate, false);
  });

  it("shows enqueued PENDING attempt=1 as CREATING", () => {
    const dto = buildSearchDataStatusResponse(
      base({
        generation: {
          ...e5Gen,
          status: "PENDING",
          attempt: 1,
          embeddedCount: 0,
        },
        vectorCount: 0,
      }),
    );
    assert.equal(dto.state, "CREATING");
    assert.equal(dto.canGenerate, false);
  });

  it("shows EMBEDDING as CREATING", () => {
    const dto = buildSearchDataStatusResponse(
      base({
        generation: {
          ...e5Gen,
          status: "EMBEDDING",
          attempt: 1,
          embeddedCount: 10,
        },
        vectorCount: 10,
      }),
    );
    assert.equal(dto.state, "CREATING");
    assert.equal(dto.canGenerate, false);
  });

  it("enables validate after CREATED with complete vectors", () => {
    const dto = buildSearchDataStatusResponse(
      base({
        generation: { ...e5Gen, status: "INDEXING" },
        vectorCount: 86,
      }),
    );
    assert.equal(dto.state, "CREATED");
    assert.equal(dto.canValidate, true);
    assert.equal(dto.canRunServiceValidation, false);
    assert.equal(dto.modelLabel, "multilingual-e5-small-ko-v2");
  });

  it("enables service validation only when VALIDATED", () => {
    const dto = buildSearchDataStatusResponse(
      base({
        generation: { ...e5Gen, status: "READY" },
        vectorCount: 86,
        evaluationStepStatus: "PASS",
        evaluationTotalCases: 5,
        evaluationPassedCases: 5,
      }),
    );
    assert.equal(dto.state, "VALIDATED");
    assert.equal(dto.canRunServiceValidation, true);
  });
});
