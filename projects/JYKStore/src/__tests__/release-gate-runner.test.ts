import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeReleaseGateStatus,
  evaluateChunkQualityReleaseGate,
  evaluateRetrievalEvaluationReleaseGate,
  evaluateStructureQualityReleaseGate,
} from "@/lib/release-gate/release-gate-runner";
import { releaseGateAllowsApprovalStatus } from "@/lib/release-gate/release-gate-readiness";
import type { ReleaseGateIssue } from "@/lib/release-gate/release-gate-types";

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
    const { issues } = evaluateChunkQualityReleaseGate({
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
        checkedAt: new Date().toISOString(),
        issues: [],
        metrics: [],
      },
      freshness: {
        status: "STALE",
        reason: "stale",
        reasonCode: "CHUNK_CHANGED",
        latestVersionId: "v",
        reportVersionId: "v",
        reportCheckedAt: null,
        latestChunkActivityAt: null,
        latestSourceDocumentUpdatedAt: null,
        latestSourceValidationCheckedAt: null,
        structureQualityFreshnessStatus: null,
      },
    });
    assert.ok(issues.some((i) => i.code === "CHUNK_QUALITY_STALE"));
  });

  it("retrieval fail is BLOCKER", () => {
    const { issues } = evaluateRetrievalEvaluationReleaseGate({
      set: { id: "s", name: "n", activeCaseCount: 5, updatedAt: new Date().toISOString() },
      latestRun: {
        id: "run",
        setId: "s",
        packId: "p",
        versionId: "v",
        status: "FAIL",
        retrievalMode: "mixed",
        totalCaseCount: 5,
        evaluatedCaseCount: 5,
        passCaseCount: 0,
        warningCaseCount: 0,
        failCaseCount: 5,
        hitRate: 0,
        meanReciprocalRank: 0,
        caseHitRate: 0,
        caseMeanReciprocalRank: 0,
        evaluatedResultCount: 10,
        passResultCount: 0,
        warningResultCount: 0,
        failResultCount: 10,
        resultHitRate: 0,
        resultMeanReciprocalRank: 0,
        averageTopRank: null,
        averageScore: 0,
        totalScore: 0,
        blockingIssueCount: 1,
        warningIssueCount: 0,
        summary: "",
        checkedBy: "SYSTEM",
        checkedAt: new Date().toISOString(),
        issues: [],
        modeSummary: {
          keyword: {
            evaluatedResultCount: 5,
            pass: 0,
            warning: 0,
            fail: 5,
            hitRate: 0,
            meanReciprocalRank: 0,
            averageTopRank: null,
            averageScore: 0,
          },
          hybrid: {
            evaluatedResultCount: 5,
            pass: 0,
            warning: 0,
            fail: 5,
            hitRate: 0,
            meanReciprocalRank: 0,
            averageTopRank: null,
            averageScore: 0,
          },
        },
      },
      freshness: {
        status: "CURRENT",
        reason: null,
        reasonCode: null,
        latestVersionId: "v",
        runVersionId: "v",
        runCheckedAt: new Date().toISOString(),
        activeSetId: "s",
        activeCaseCount: 5,
        latestCaseUpdatedAt: null,
        latestChunkActivityAt: null,
        latestSourceDocumentUpdatedAt: null,
        latestSourceValidationCheckedAt: null,
        chunkQualityFreshnessStatus: "CURRENT",
      },
    });
    assert.ok(issues.some((i) => i.code === "RETRIEVAL_EVALUATION_FAILED"));
  });
});
