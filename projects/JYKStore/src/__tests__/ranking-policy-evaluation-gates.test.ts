import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { isSearchFoundationStagesPassedStrict } from "../lib/docling-knowledge/docling-knowledge-stage-pass.ts";
import {
  resolveSearchEvaluationValidity,
  resolveValidationLockReason,
} from "../lib/distribution/service-validation-service.ts";
import {
  buildSearchDataStatusResponse,
  type SearchDataStatusInput,
} from "../lib/search-data/search-data-state.ts";
import {
  RETRIEVAL_RANKING_POLICY_VERSION,
  selectDiverseTopK,
} from "../lib/retrieval/relevance-diversity-rerank.ts";
import type { ScoredCandidate } from "../lib/retrieval/retrieval-types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

const SERVICE_VALIDATION_MODULE_FILES = [
  "service-validation-policy.ts",
  "service-validation-queries.ts",
  "service-validation-provider-status.ts",
  "service-validation-run-commands.ts",
  "service-validation-evidence-asserts.ts",
  "service-validation-admin-listing.ts",
];

function readServiceValidationModules(rootDir: string): string {
  return SERVICE_VALIDATION_MODULE_FILES.map((f) =>
    readFileSync(join(rootDir, "src/lib/distribution", f), "utf8"),
  ).join("\n");
}

const e5Gen = {
  id: "g1",
  status: "READY",
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

function base(overrides: Partial<SearchDataStatusInput> = {}): SearchDataStatusInput {
  return {
    structurePassed: true,
    pipelineCurrent: true,
    packStatusIsDraft: true,
    chunkCount: 86,
    generation: { ...e5Gen },
    vectorCount: 86,
    evaluationStepStatus: "PASS",
    evaluationTotalCases: 5,
    evaluationPassedCases: 5,
    ...overrides,
  };
}

const structureSteps = [
  { step: "STRUCTURE_VALIDATING", status: "PASS", details: { advisory: true } },
  { step: "KNOWLEDGE_CHECKING", status: "PASS" },
  { step: "CHUNKING", status: "PASS", details: { chunkCount: 3 } },
  { step: "INDEXING", status: "PASS" },
];

describe("ranking policy evaluation gates", () => {
  it("exposes rankingPolicyStale DTO fields and re-validate flags for outdated policy", () => {
    const dto = buildSearchDataStatusResponse(
      base({ evaluationRankingPolicyVersion: "relevance_diversity_v1" }),
    );
    assert.equal(dto.state, "VALIDATED");
    assert.equal(dto.rankingPolicyStale, true);
    assert.equal(dto.currentRankingPolicyVersion, RETRIEVAL_RANKING_POLICY_VERSION);
    assert.equal(dto.evaluatedRankingPolicyVersion, "relevance_diversity_v1");
    assert.equal(dto.canValidate, true);
    assert.equal(dto.canRunServiceValidation, false);
  });

  it("clears rankingPolicyStale when evaluation is on current policy", () => {
    const dto = buildSearchDataStatusResponse(
      base({ evaluationRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION }),
    );
    assert.equal(dto.rankingPolicyStale, false);
    assert.equal(dto.canRunServiceValidation, true);
  });

  it("treats missing evaluation policy version as stale", () => {
    const dto = buildSearchDataStatusResponse(base({ evaluationRankingPolicyVersion: null }));
    assert.equal(dto.rankingPolicyStale, true);
    assert.equal(dto.canValidate, true);
  });

  it("requires current ranking policy for search foundation strict pass", () => {
    assert.equal(
      isSearchFoundationStagesPassedStrict({
        pipelineCurrent: true,
        steps: [
          ...structureSteps,
          { step: "SEARCH_EVALUATING", status: "PASS", details: {} },
        ],
      }),
      false,
    );
    assert.equal(
      isSearchFoundationStagesPassedStrict({
        pipelineCurrent: true,
        steps: [
          ...structureSteps,
          {
            step: "SEARCH_EVALUATING",
            status: "PASS",
            details: { retrievalRankingPolicyVersion: "relevance_diversity_v1" },
          },
        ],
      }),
      false,
    );
    assert.equal(
      isSearchFoundationStagesPassedStrict({
        pipelineCurrent: true,
        steps: [
          ...structureSteps,
          {
            step: "SEARCH_EVALUATING",
            status: "PASS",
            details: { retrievalRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION },
          },
        ],
      }),
      true,
    );
  });

  it("classifies search evaluation validity reasons", () => {
    assert.deepEqual(
      resolveSearchEvaluationValidity({
        status: null,
        expectedRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
      }),
      { current: false, reason: "EVALUATION_MISSING" },
    );
    assert.deepEqual(
      resolveSearchEvaluationValidity({
        status: "WARNING",
        details: { retrievalRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION },
        expectedRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
      }),
      { current: false, reason: "EVALUATION_NOT_PASSED" },
    );
    assert.deepEqual(
      resolveSearchEvaluationValidity({
        status: "PASS",
        details: { retrievalRankingPolicyVersion: "relevance_diversity_v1" },
        expectedRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
      }),
      { current: false, reason: "RANKING_POLICY_STALE" },
    );
    assert.deepEqual(
      resolveSearchEvaluationValidity({
        status: "PASS",
        details: { retrievalRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION },
        expectedRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
      }),
      { current: true },
    );
  });

  it("resolves validation lock reasons by priority", () => {
    assert.equal(
      resolveValidationLockReason({
        packStatus: "DRAFT",
        hasOpenReview: true,
        bindingStatus: "CURRENT",
        searchDataReady: true,
      }),
      "OPEN_REVIEW",
    );
    assert.equal(
      resolveValidationLockReason({
        packStatus: "PUBLISHED",
        bindingStatus: "CURRENT",
        searchDataReady: true,
      }),
      "PACK_NOT_DRAFT",
    );
    assert.equal(
      resolveValidationLockReason({
        packStatus: "DRAFT",
        bindingStatus: "MISSING",
        searchDataReady: false,
      }),
      "BINDING_MISSING",
    );
    assert.equal(
      resolveValidationLockReason({
        packStatus: "DRAFT",
        bindingStatus: "STALE",
        searchDataReady: false,
      }),
      "BINDING_STALE",
    );
    assert.equal(
      resolveValidationLockReason({
        packStatus: "DRAFT",
        bindingStatus: "CURRENT",
        searchDataReady: false,
      }),
      "SEARCH_DATA_NOT_READY",
    );
    assert.equal(
      resolveValidationLockReason({
        packStatus: "DRAFT",
        bindingStatus: "CURRENT",
        searchDataReady: true,
      }),
      null,
    );
  });

  it("records rerank stats including uniqueCandidateCount", () => {
    const scored = Array.from({ length: 20 }, (_, i) => {
      const title = i < 3 ? "동일 제목 중복" : `고유 결과 ${i}`;
      const content = i < 3 ? "동일 본문 중복 후보입니다." : `고유 본문 내용 ${i} 감리 점검 항목`;
      return {
        score: 10 - i * 0.1,
        keywordScore: 1,
        metadataScore: 0,
        vectorScore: 0.9 - i * 0.01,
        vectorSimilarity: 0.9 - i * 0.01,
        chunk: {
          id: `c${i}`,
          packId: "p",
          versionId: "v",
          sourceDocumentId: "s",
          title,
          content,
          section: null,
          tags: [] as string[],
          sortOrder: i,
          createdAt: new Date(0),
          metadata: { pageStart: i + 1, pageEnd: i + 1 },
        },
      };
    }) as unknown as ScoredCandidate[];

    const { stats } = selectDiverseTopK({
      scored,
      query: "감리 점검",
      topK: 5,
    });
    assert.equal(stats.rerankMode, RETRIEVAL_RANKING_POLICY_VERSION);
    assert.equal(stats.candidateCount, 20);
    assert.ok(stats.deduplicatedCount >= 1);
    const expectedUnique = stats.candidateCount - stats.deduplicatedCount;
    assert.ok(expectedUnique >= stats.finalResultCount);
    assert.equal(expectedUnique, stats.candidateCount - stats.deduplicatedCount);
    assert.ok(stats.finalResultCount <= 5);
    assert.ok(stats.finalResultCount >= 1);
  });

  it("maps NOT_READY binding to SEARCH_DATA_NOT_READY lock reason", () => {
    assert.equal(
      resolveValidationLockReason({
        packStatus: "DRAFT",
        bindingStatus: "NOT_READY",
        searchDataReady: false,
      }),
      "SEARCH_DATA_NOT_READY",
    );
  });

  it("wires open-review assert and latest-only binding helpers", () => {
    const bindingSrc = readFileSync(
      join(root, "src/lib/distribution/service-validation-binding.ts"),
      "utf8",
    );
    assert.ok(bindingSrc.includes("LATEST_RUN_PENDING"));
    assert.ok(bindingSrc.includes("LATEST_RUN_RUNNING"));
    assert.ok(bindingSrc.includes("Never falls back to an older PASS"));
    assert.ok(bindingSrc.includes("staleErrorForBindingState"));
    assert.match(bindingSrc, /resolveCurrentValidationBindingTx[\s\S]*resolveValidationBindingState/);

    const service = readServiceValidationModules(root);
    assert.ok(service.includes("assertNoOpenPackReview"));
    assert.ok(service.includes("OPEN_PACK_REVIEW_STATUSES"));
    assert.match(
      service,
      /requireOwnedDraftPackForServiceValidationRun[\s\S]*assertNoOpenPackReview/,
    );
  });

  it("wires docling eval + service validation gate + re-eval UX", () => {
    const evalSrc = readFileSync(
      join(root, "src/lib/docling-knowledge/docling-knowledge-eval.ts"),
      "utf8",
    );
    assert.ok(evalSrc.includes("retrievalRankingPolicyVersion"));
    assert.ok(evalSrc.includes("RETRIEVAL_RANKING_POLICY_VERSION"));

    const validateSrc = readFileSync(
      join(root, "src/lib/search-data/search-data-generation-service.ts"),
      "utf8",
    );
    assert.ok(validateSrc.includes("retrievalRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION"));

    const service = readServiceValidationModules(root);
    assert.ok(service.includes("SEARCH_EVALUATION_POLICY_STALE"));
    assert.ok(service.includes("SEARCH_EVALUATION_REQUIRED"));
    assert.ok(service.includes("assertSearchEvaluationCurrentForChannel"));
    assert.ok(service.includes("uniqueCandidateCount"));

    const tab = readFileSync(
      join(root, "src/components/provider-distribution/ProviderServiceValidationTab.tsx"),
      "utf8",
    );
    assert.ok(tab.includes("자동 평가 다시 실행"));
    assert.ok(tab.includes("rankingPolicyStale"));
    assert.ok(tab.includes("자동 평가 다시 필요"));

    const submit = readFileSync(
      join(root, "src/lib/distribution/distribution-submit-service.ts"),
      "utf8",
    );
    assert.ok(submit.includes("RETRIEVAL_EVALUATION_POLICY_CURRENT"));
  });
});
