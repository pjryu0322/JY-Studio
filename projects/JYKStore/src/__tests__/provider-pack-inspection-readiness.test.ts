import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildProviderInspectionReadiness } from "@/lib/provider-pack-inspection-readiness";
import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import type { StructureQualitySummaryDto } from "@/lib/structure-quality/structure-quality-dto";
import type { ChunkQualitySummaryDto } from "@/lib/chunk-quality/chunk-quality-dto";
import type { RetrievalEvaluationSummaryDto } from "@/lib/retrieval-evaluation/retrieval-evaluation-dto";
import type { ReleaseGateSummaryDto } from "@/lib/release-gate/release-gate-dto";

const NOW = "2026-07-08T12:00:00.000Z";

function passingStructureQualitySummary(): StructureQualitySummaryDto {
  return {
    structureTemplateKey: "GENERIC_PRODUCT",
    structureTemplateName: "Generic",
    structureCoverage: {
      id: "sc",
      packId: "p",
      versionId: "v",
      templateKey: "GENERIC_PRODUCT",
      templateName: "Generic",
      status: "PASS",
      coverageScore: 100,
      requiredSectionCount: 1,
      coveredRequiredCount: 1,
      missingRequiredCount: 0,
      optionalSectionCount: 0,
      coveredOptionalCount: 0,
      summary: "ok",
      checkedAt: NOW,
      items: [],
    },
    knowledgeQuality: {
      id: "kq",
      packId: "p",
      versionId: "v",
      status: "PASS",
      totalScore: 90,
      completenessScore: 90,
      consistencyScore: 90,
      sourceQualityScore: 90,
      securityScore: 90,
      freshnessScore: 90,
      usabilityScore: 90,
      blockingIssueCount: 0,
      warningIssueCount: 0,
      summary: "ok",
      checkedAt: NOW,
      issues: [],
    },
    freshness: {
      status: "CURRENT",
      reason: null,
      reasonCode: null,
      latestVersionId: "v",
      coverageReportVersionId: "v",
      qualityReportVersionId: "v",
      coverageCheckedAt: NOW,
      qualityCheckedAt: NOW,
      latestSourceDocumentUpdatedAt: null,
      latestSourceValidationCheckedAt: null,
    },
  };
}

function passingChunkQualitySummary(): ChunkQualitySummaryDto {
  return {
    report: {
      id: "r1",
      packId: "p",
      versionId: "v",
      status: "PASS",
      totalScore: 90,
      coverageScore: 90,
      traceabilityScore: 90,
      sizeScore: 90,
      duplicateScore: 90,
      metadataScore: 90,
      structureAlignmentScore: 90,
      activeChunkCount: 1,
      inactiveChunkCount: 0,
      sourceDocumentCount: 1,
      coveredSourceDocumentCount: 1,
      orphanChunkCount: 0,
      missingSourceChunkCount: 0,
      shortChunkCount: 0,
      longChunkCount: 0,
      duplicateChunkCount: 0,
      chunkWithoutMetadataCount: 0,
      blockingIssueCount: 0,
      warningIssueCount: 0,
      summary: "",
      checkedAt: NOW,
      issues: [],
      metrics: [],
    },
    freshness: {
      status: "CURRENT",
      reason: null,
      reasonCode: null,
      latestVersionId: "v",
      reportVersionId: "v",
      reportCheckedAt: NOW,
      latestChunkActivityAt: null,
      latestSourceDocumentUpdatedAt: null,
      latestSourceValidationCheckedAt: null,
      latestStructureCoverageCheckedAt: null,
      latestKnowledgeQualityCheckedAt: null,
    },
  };
}

function emptyModeSummary() {
  return {
    evaluatedResultCount: 5,
    pass: 5,
    warning: 0,
    fail: 0,
    hitRate: 1,
    meanReciprocalRank: 1,
    averageTopRank: 1,
    averageScore: 10,
  };
}

function passingRetrievalEvaluationSummary(): RetrievalEvaluationSummaryDto {
  return {
    set: { id: "s", name: "n", activeCaseCount: 5, updatedAt: NOW },
    latestRun: {
      id: "run",
      setId: "s",
      packId: "p",
      versionId: "v",
      status: "PASS",
      retrievalMode: "mixed",
      totalCaseCount: 5,
      evaluatedCaseCount: 5,
      passCaseCount: 5,
      warningCaseCount: 0,
      failCaseCount: 0,
      hitRate: 1,
      meanReciprocalRank: 1,
      caseHitRate: 1,
      caseMeanReciprocalRank: 1,
      evaluatedResultCount: 10,
      passResultCount: 10,
      warningResultCount: 0,
      failResultCount: 0,
      resultHitRate: 1,
      resultMeanReciprocalRank: 1,
      averageTopRank: 1,
      averageScore: 10,
      totalScore: 100,
      blockingIssueCount: 0,
      warningIssueCount: 0,
      summary: "ok",
      checkedBy: "SYSTEM",
      checkedAt: NOW,
      issues: [],
      modeSummary: {
        keyword: emptyModeSummary(),
        hybrid: emptyModeSummary(),
      },
    },
    freshness: {
      status: "CURRENT",
      reason: null,
      reasonCode: null,
      latestVersionId: "v",
      runVersionId: "v",
      runCheckedAt: NOW,
      activeSetId: "s",
      activeCaseCount: 5,
      latestCaseUpdatedAt: null,
      latestChunkActivityAt: null,
      latestSourceDocumentUpdatedAt: null,
      latestSourceValidationCheckedAt: null,
      latestStructureCoverageCheckedAt: null,
      latestKnowledgeQualityCheckedAt: null,
      latestChunkQualityCheckedAt: null,
    },
  };
}

function passingReleaseGateSummary(): ReleaseGateSummaryDto {
  return {
    latestRun: {
      id: "rg1",
      packId: "p",
      versionId: "v",
      targetStatus: "PUBLISHED",
      status: "PASS",
      blockingIssueCount: 0,
      warningIssueCount: 0,
      sourceStatus: "PASS",
      structureStatus: "PASS",
      chunkStatus: "PASS",
      retrievalStatus: "PASS",
      graphStatus: null,
      summary: "ok",
      checkedBy: "system",
      checkedAt: NOW,
      issues: [],
    },
    freshness: {
      status: "CURRENT",
      reason: null,
      checkedAt: NOW,
      versionId: "v",
    },
  };
}

function basePack(overrides: Partial<ProviderPackDetailDto> = {}): ProviderPackDetailDto {
  return {
    packId: "p",
    name: "Pack",
    categoryId: "c",
    status: "DRAFT",
    pipelineStatus: "IDLE",
    pipelineUpdatedAt: null,
    shortDescription: "",
    description: "",
    tags: [],
    icon: "",
    pricing: "",
    providerName: "Provider",
    structureTemplateKey: "GENERIC_PRODUCT",
    structureQuality: null,
    chunkQuality: null,
    retrievalEvaluation: null,
    releaseGate: null,
    latestRejectionReason: null,
    versions: [
      {
        id: "v",
        version: "0.1.0",
        overview: "",
        features: [],
        includedKnowledge: [],
        supportedEnvironments: [],
        targetUsers: [],
        useCases: [],
        versionSummary: "",
        sourceDocuments: [
          {
            id: "d1",
            title: "Doc",
            sourceType: "FILE",
            sourceFormat: "MARKDOWN",
            sourceUrl: null,
            productVersion: null,
            documentVersion: null,
            validationStatus: "PASS",
            validationSummary: null,
            validationScore: null,
            blockingIssueCount: 0,
            warningIssueCount: 0,
            validationIssues: [],
            createdAt: NOW,
          },
        ],
      },
    ],
    updatedAt: NOW,
    ...overrides,
  };
}

const readyInput = {
  sourceDocumentCount: 1,
  knowledgeUnitDraftCount: 2,
};

describe("provider pack inspection readiness", () => {
  it("0/5 shows auto prepare as primary user action", () => {
    const readiness = buildProviderInspectionReadiness({
      pack: basePack(),
      ...readyInput,
    });

    assert.equal(readiness.nextAction, "RUN_STRUCTURE_QUALITY");
    assert.equal(readiness.primaryActionKind, "RUN_AUTO_PREPARE");
    assert.equal(readiness.primaryActionLabel, "자동 점검 시작");
    assert.equal(readiness.completedCount, 0);
    assert.equal(readiness.totalCount, 5);
    assert.equal(readiness.canSubmitReview, false);
  });

  it("later steps wait until structure is done", () => {
    const readiness = buildProviderInspectionReadiness({
      pack: basePack(),
      ...readyInput,
    });

    assert.equal(readiness.steps[0]?.checklistStatus, "current");
    assert.equal(readiness.steps[1]?.checklistStatus, "waiting");
    assert.equal(readiness.steps[2]?.checklistStatus, "waiting");
    assert.equal(readiness.steps[3]?.checklistStatus, "waiting");
    assert.equal(readiness.steps[4]?.checklistStatus, "waiting");
  });

  it("all checks done → go to submit review", () => {
    const readiness = buildProviderInspectionReadiness({
      pack: basePack({
        structureQuality: passingStructureQualitySummary(),
        chunkQuality: passingChunkQualitySummary(),
        retrievalEvaluation: passingRetrievalEvaluationSummary(),
        releaseGate: passingReleaseGateSummary(),
      }),
      ...readyInput,
    });

    assert.equal(readiness.nextAction, "GO_TO_SUBMIT_REVIEW");
    assert.equal(readiness.userState, "review_ready");
    assert.equal(readiness.primaryActionLabel, "검수요청으로 이동");
    assert.equal(readiness.canSubmitReview, true);
    assert.equal(readiness.currentStepId, "completed");
  });
});
