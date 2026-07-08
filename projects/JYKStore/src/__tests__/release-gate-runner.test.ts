import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeReleaseGateStatus,
  evaluateChunkQualityReleaseGate,
  evaluateRetrievalEvaluationReleaseGate,
  evaluateStructureQualityReleaseGate,
  runReleaseGateEvaluation,
} from "@/lib/release-gate/release-gate-runner";
import { releaseGateAllowsApprovalStatus } from "@/lib/release-gate/release-gate-readiness";
import type { ReleaseGateIssue } from "@/lib/release-gate/release-gate-types";
import type { StructureQualitySummaryDto } from "@/lib/structure-quality/structure-quality-dto";
import type { ChunkQualitySummaryDto } from "@/lib/chunk-quality/chunk-quality-dto";
import type { RetrievalEvaluationSummaryDto } from "@/lib/retrieval-evaluation/retrieval-evaluation-dto";

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

describe("release gate runner status", () => {
  it("FAIL when any BLOCKER exists", () => {
    const issues: ReleaseGateIssue[] = [
      { severity: "BLOCKER", code: "X", message: "block" },
      { severity: "WARNING", code: "Y", message: "warn" },
    ];
    const result = computeReleaseGateStatus(issues);
    assert.equal(result.status, "FAIL");
    assert.equal(result.blockingIssueCount, 1);
  });

  it("WARNING when only warnings exist", () => {
    const issues: ReleaseGateIssue[] = [{ severity: "WARNING", code: "Y", message: "warn" }];
    const result = computeReleaseGateStatus(issues);
    assert.equal(result.status, "WARNING");
  });

  it("PASS when no issues", () => {
    const result = computeReleaseGateStatus([]);
    assert.equal(result.status, "PASS");
  });

  it("allows approval for PASS and WARNING only", () => {
    assert.equal(releaseGateAllowsApprovalStatus("PASS"), true);
    assert.equal(releaseGateAllowsApprovalStatus("WARNING"), true);
    assert.equal(releaseGateAllowsApprovalStatus("FAIL"), false);
  });
});

describe("release gate quality mapping", () => {
  it("structure missing is BLOCKER", () => {
    const { issues, sectionStatus } = evaluateStructureQualityReleaseGate(null);
    assert.equal(sectionStatus, "MISSING");
    assert.ok(issues.some((i) => i.code === "STRUCTURE_QUALITY_MISSING"));
  });

  it("chunk stale is BLOCKER", () => {
    const passing = passingChunkQualitySummary();
    const { issues } = evaluateChunkQualityReleaseGate({
      ...passing,
      freshness: {
        ...passing.freshness,
        status: "STALE",
        reason: "stale",
        reasonCode: "CHUNK_CHANGED",
      },
    });
    assert.ok(issues.some((i) => i.code === "CHUNK_QUALITY_STALE"));
  });

  it("retrieval fail is BLOCKER", () => {
    const passing = passingRetrievalEvaluationSummary();
    const { issues } = evaluateRetrievalEvaluationReleaseGate({
      ...passing,
      latestRun: {
        ...passing.latestRun!,
        status: "FAIL",
        passCaseCount: 0,
        failCaseCount: 5,
        hitRate: 0,
        meanReciprocalRank: 0,
        caseHitRate: 0,
        caseMeanReciprocalRank: 0,
        passResultCount: 0,
        failResultCount: 10,
        resultHitRate: 0,
        resultMeanReciprocalRank: 0,
        totalScore: 0,
        blockingIssueCount: 1,
      },
    });
    assert.ok(issues.some((i) => i.code === "RETRIEVAL_EVALUATION_FAILED"));
  });
});

describe("release gate overall status with source WARNING", () => {
  it("elevates overall status to WARNING when source validation is WARNING", () => {
    const result = runReleaseGateEvaluation({
      packStatus: "REVIEWING",
      versionId: "v",
      hasRequiredDescription: true,
      sourceDocuments: [
        {
          id: "doc-1",
          title: "Doc",
          validationStatus: "WARNING",
          updatedAt: "2026-07-08T10:00:00.000Z",
        },
      ],
      latestReportsByDocumentId: {
        "doc-1": { status: "WARNING", checkedAt: NOW },
      },
      structureQuality: passingStructureQualitySummary(),
      chunkQuality: passingChunkQualitySummary(),
      retrievalEvaluation: passingRetrievalEvaluationSummary(),
      graphNodeCount: 3,
      targetStatus: "PUBLISHED",
      requireReviewingStatus: true,
    });

    assert.equal(result.sourceStatus, "WARNING");
    assert.equal(result.status, "WARNING");
    assert.equal(result.blockingIssueCount, 0);
    assert.ok(result.warningIssueCount >= 1);
    assert.ok(result.issues.some((i) => i.code === "SOURCE_VALIDATION_WARNING"));
    assert.equal(releaseGateAllowsApprovalStatus(result.status), true);
  });
});
