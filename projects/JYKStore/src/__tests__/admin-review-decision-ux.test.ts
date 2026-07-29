import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { AdminReviewDetailDto } from "../lib/admin-review-dto.ts";
import {
  canApproveAdminReview,
  defaultOpenAdminReviewSections,
  resolveReviewDecisionState,
} from "../lib/admin-review-decision.ts";
import {
  ADMIN_REVIEW_CTA_APPROVE,
  ADMIN_REVIEW_CTA_REJECT,
  ADMIN_REVIEW_CTA_RELEASE_GATE,
} from "../lib/role-based-ux-copy.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

function baseDetail(overrides: Partial<AdminReviewDetailDto> = {}): AdminReviewDetailDto {
  const readiness = {
    versionCount: 1,
    sourceDocumentCount: 9,
    hasRequiredDescription: true,
    canApprove: true,
    pipelineStatus: "READY",
    sourceValidation: {
      passCount: 5,
      warningCount: 0,
      failCount: 0,
      notCheckedCount: 0,
    },
    sourceTypeCoverage: {},
    structureCoverageStatus: "PASS",
    knowledgeQualityStatus: "PASS",
    structureQualityMessage: null,
    chunkQualityStatus: "PASS",
    chunkQualityMessage: null,
    retrievalEvaluationStatus: "PASS",
    retrievalEvaluationMessage: null,
    releaseGateStatus: "PASS" as string | null,
    releaseGateMessage: null,
    ...(overrides.readiness ?? {}),
  };

  return {
    pack: {
      packId: "pack-1",
      name: "Test Pack",
      providerName: "Provider",
      providerType: "ORG",
      categoryId: "cat",
      status: "REVIEWING",
      pricing: "FREE",
      icon: "📦",
      shortDescription: "short",
      description: "long",
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(overrides.pack ?? {}),
    },
    versions: overrides.versions ?? [],
    latestReview:
      overrides.latestReview === undefined
        ? {
            id: "rev-accepted",
            status: "IN_REVIEW",
            decision: null,
            memo: null,
            rejectionReason: null,
            reviewerUserId: "admin-1",
            createdAt: new Date().toISOString(),
            decidedAt: null,
            submitSnapshot: null,
          }
        : overrides.latestReview,
    readiness,
    payload: overrides.payload ?? null,
    currentManifestFingerprint: overrides.currentManifestFingerprint ?? null,
    doclingReviewIntegrity: overrides.doclingReviewIntegrity ?? null,
    distribution: overrides.distribution ?? null,
    artifactOptions: overrides.artifactOptions ?? null,
    structureQuality: overrides.structureQuality ?? null,
    chunkQuality: overrides.chunkQuality ?? null,
    retrievalEvaluation: overrides.retrievalEvaluation ?? null,
    releaseGate:
      overrides.releaseGate === undefined
        ? {
            latestRun: {
              id: "rg-1",
              packId: "pack-1",
              versionId: null,
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
              checkedBy: "admin",
              checkedAt: new Date().toISOString(),
              issues: [],
            },
            freshness: {
              status: "CURRENT",
              reason: null,
              checkedAt: new Date().toISOString(),
              versionId: null,
            },
          }
        : overrides.releaseGate,
  };
}

describe("admin review decision state", () => {
  it("Case 1: stale quality signals require full refresh, not blocked", () => {
    const detail = baseDetail({
      readiness: {
        versionCount: 1,
        sourceDocumentCount: 9,
        hasRequiredDescription: true,
        canApprove: false,
        pipelineStatus: "READY",
        sourceValidation: { passCount: 5, warningCount: 4, failCount: 0, notCheckedCount: 0 },
        sourceTypeCoverage: {},
        structureCoverageStatus: "PASS",
        knowledgeQualityStatus: "PASS",
        structureQualityMessage: "구조/품질 점검이 최신 상태가 아닙니다. 재평가해 주세요.",
        chunkQualityStatus: "PASS",
        chunkQualityMessage: "청킹 품질 점검이 최신 상태가 아닙니다. 재평가 후 검색 품질을 실행해 주세요.",
        retrievalEvaluationStatus: "PASS",
        retrievalEvaluationMessage: null,
        releaseGateStatus: "FAIL",
        releaseGateMessage:
          "릴리스 게이트(FAIL)로 승인할 수 없습니다. 차단 항목을 해결한 뒤 재점검해 주세요.",
      },
    });
    assert.equal(resolveReviewDecisionState(detail), "review_refresh_required");
    assert.equal(canApproveAdminReview(detail), false);
  });

  it("Case 2: release gate missing requires final check", () => {
    const detail = baseDetail({
      releaseGate: {
        latestRun: null,
        freshness: { status: "MISSING", reason: null, checkedAt: null, versionId: null },
      },
      readiness: {
        versionCount: 1,
        sourceDocumentCount: 9,
        hasRequiredDescription: true,
        canApprove: false,
        pipelineStatus: "READY",
        sourceValidation: { passCount: 9, warningCount: 0, failCount: 0, notCheckedCount: 0 },
        sourceTypeCoverage: {},
        structureCoverageStatus: "PASS",
        knowledgeQualityStatus: "PASS",
        structureQualityMessage: null,
        chunkQualityStatus: "PASS",
        chunkQualityMessage: null,
        retrievalEvaluationStatus: "PASS",
        retrievalEvaluationMessage: null,
        releaseGateStatus: null,
        releaseGateMessage: "릴리스 게이트 재점검을 먼저 실행해 주세요.",
      },
    });
    assert.equal(resolveReviewDecisionState(detail), "release_gate_required");
    assert.equal(canApproveAdminReview(detail), false);
  });

  it("Case 3: approval ready when release gate PASS", () => {
    const detail = baseDetail();
    assert.equal(resolveReviewDecisionState(detail), "approval_ready");
    assert.equal(canApproveAdminReview(detail), true);
  });

  it("Case 4: approval warning when source warnings exist", () => {
    const detail = baseDetail({
      readiness: {
        versionCount: 1,
        sourceDocumentCount: 9,
        hasRequiredDescription: true,
        canApprove: true,
        pipelineStatus: "READY",
        sourceValidation: { passCount: 5, warningCount: 4, failCount: 0, notCheckedCount: 0 },
        sourceTypeCoverage: {},
        structureCoverageStatus: "PASS",
        knowledgeQualityStatus: "WARNING",
        structureQualityMessage: null,
        chunkQualityStatus: "PASS",
        chunkQualityMessage: null,
        retrievalEvaluationStatus: "PASS",
        retrievalEvaluationMessage: null,
        releaseGateStatus: "WARNING",
        releaseGateMessage: null,
      },
      releaseGate: {
        latestRun: {
          id: "rg-1",
          packId: "pack-1",
          versionId: null,
          targetStatus: "PUBLISHED",
          status: "WARNING",
          blockingIssueCount: 0,
          warningIssueCount: 1,
          sourceStatus: "WARNING",
          structureStatus: "PASS",
          chunkStatus: "PASS",
          retrievalStatus: "PASS",
          graphStatus: null,
          summary: "warn",
          checkedBy: "admin",
          checkedAt: new Date().toISOString(),
          issues: [],
        },
        freshness: {
          status: "CURRENT",
          reason: null,
          checkedAt: new Date().toISOString(),
          versionId: null,
        },
      },
    });
    assert.equal(resolveReviewDecisionState(detail), "approval_warning");
    assert.equal(canApproveAdminReview(detail), true);
  });

  it("Case 5: approval blocked when retrieval FAIL without stale signals", () => {
    const detail = baseDetail({
      readiness: {
        versionCount: 1,
        sourceDocumentCount: 9,
        hasRequiredDescription: true,
        canApprove: false,
        pipelineStatus: "READY",
        sourceValidation: { passCount: 9, warningCount: 0, failCount: 0, notCheckedCount: 0 },
        sourceTypeCoverage: {},
        structureCoverageStatus: "PASS",
        knowledgeQualityStatus: "PASS",
        structureQualityMessage: null,
        chunkQualityStatus: "PASS",
        chunkQualityMessage: null,
        retrievalEvaluationStatus: "FAIL",
        retrievalEvaluationMessage: "검색 품질 평가가 기준에 미달합니다.",
        releaseGateStatus: "PASS",
        releaseGateMessage: null,
      },
    });
    assert.equal(resolveReviewDecisionState(detail), "approval_blocked");
    assert.equal(canApproveAdminReview(detail), false);
  });

  it("Case 7: submitSnapshot PASS prefers approval_ready over refresh", () => {
    const detail = baseDetail({
      latestReview: {
        id: "rev-1",
        status: "IN_REVIEW",
        decision: null,
        memo: null,
        rejectionReason: null,
        reviewerUserId: "admin-1",
        createdAt: new Date().toISOString(),
        decidedAt: null,
        submitSnapshot: {
          submittedAt: "2026-07-10T15:32:00.000Z",
          submittedVersionId: "v1",
          sourceDocumentIds: ["d1"],
          activeChunkIds: ["c1"],
          sourceDocumentCount: 1,
          activeChunkCount: 1,
          releaseGateRunId: "rg-1",
          releaseGateStatus: "PASS",
          retrievalEvaluationRunId: "run-1",
          warnings: [],
        },
      },
      versions: [
        {
          id: "v1",
          version: "1.0.0",
          overview: "",
          features: [],
          includedKnowledge: [],
          supportedEnvironments: [],
          targetUsers: [],
          useCases: [],
          versionSummary: "",
          language: null,
          sourceDocuments: [
            {
              id: "d1",
              title: "Doc",
              sourceType: "FILE",
              sourceFormat: "MARKDOWN",
              sourceUrl: null,
              productVersion: "1.0",
              documentVersion: null,
              validationStatus: "PASS",
              validationSummary: null,
              validationScore: null,
              blockingIssueCount: 0,
              warningIssueCount: 0,
              validationIssues: [],
              createdAt: new Date().toISOString(),
            },
          ],
        },
      ],
      chunkQuality: {
        report: {
          id: "cq",
          packId: "pack-1",
          versionId: "v1",
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
          uncoveredSourceDocumentCount: 0,
          blockingIssueCount: 0,
          warningIssueCount: 0,
          summary: "ok",
          checkedAt: new Date().toISOString(),
          issues: [],
        },
        freshness: {
          status: "CURRENT",
          reason: null,
          reasonCode: null,
          latestVersionId: "v1",
          reportVersionId: "v1",
          reportCheckedAt: new Date().toISOString(),
          latestChunkActivityAt: null,
          latestSourceDocumentUpdatedAt: null,
          latestSourceValidationCheckedAt: null,
          latestStructureCoverageCheckedAt: null,
          latestKnowledgeQualityCheckedAt: null,
        },
      },
      retrievalEvaluation: {
        set: { id: "s", name: "n", activeCaseCount: 5, updatedAt: new Date().toISOString() },
        latestRun: {
          id: "run-1",
          setId: "s",
          packId: "pack-1",
          versionId: "v1",
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
          checkedAt: new Date().toISOString(),
          issues: [],
          modeSummary: {
            keyword: {
              evaluatedResultCount: 5,
              pass: 5,
              warning: 0,
              fail: 0,
              hitRate: 1,
              meanReciprocalRank: 1,
              averageTopRank: 1,
              averageScore: 10,
            },
            hybrid: {
              evaluatedResultCount: 5,
              pass: 5,
              warning: 0,
              fail: 0,
              hitRate: 1,
              meanReciprocalRank: 1,
              averageTopRank: 1,
              averageScore: 10,
            },
          },
        },
        freshness: {
          status: "CURRENT",
          reason: null,
          reasonCode: null,
          latestVersionId: "v1",
          runVersionId: "v1",
          runCheckedAt: new Date().toISOString(),
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
      },
      readiness: {
        versionCount: 1,
        sourceDocumentCount: 1,
        hasRequiredDescription: true,
        canApprove: true,
        pipelineStatus: "READY",
        sourceValidation: { passCount: 1, warningCount: 0, failCount: 0, notCheckedCount: 0 },
        sourceTypeCoverage: {},
        structureCoverageStatus: "PASS",
        knowledgeQualityStatus: "PASS",
        structureQualityMessage: null,
        chunkQualityStatus: "PASS",
        chunkQualityMessage: null,
        retrievalEvaluationStatus: "PASS",
        retrievalEvaluationMessage: null,
        releaseGateStatus: "PASS",
        releaseGateMessage: null,
      },
    });

    const state = resolveReviewDecisionState(detail);
    assert.ok(state === "approval_ready" || state === "approval_warning");
    assert.notEqual(state, "review_refresh_required");
    assert.equal(canApproveAdminReview(detail), true);
  });

  it("Case 7b: PENDING review cannot approve until accepted", () => {
    const detail = baseDetail({
      latestReview: {
        id: "rev-pending",
        status: "PENDING",
        decision: null,
        memo: null,
        rejectionReason: null,
        reviewerUserId: null,
        createdAt: new Date().toISOString(),
        decidedAt: null,
        submitSnapshot: null,
      },
    });
    assert.equal(resolveReviewDecisionState(detail), "approval_ready");
    assert.equal(canApproveAdminReview(detail), false);
  });

  it("Case 8: submitSnapshot drift is separated from refresh-required", () => {
    const detail = baseDetail({
      latestReview: {
        id: "rev-1",
        status: "IN_REVIEW",
        decision: null,
        memo: null,
        rejectionReason: null,
        reviewerUserId: "admin-1",
        createdAt: new Date().toISOString(),
        decidedAt: null,
        submitSnapshot: {
          submittedAt: "2026-07-10T15:32:00.000Z",
          submittedVersionId: "v1",
          sourceDocumentIds: ["d1"],
          activeChunkIds: ["c1"],
          sourceDocumentCount: 1,
          activeChunkCount: 1,
          releaseGateRunId: "rg-1",
          releaseGateStatus: "PASS",
          warnings: [],
        },
      },
      versions: [
        {
          id: "v1",
          version: "1.0.0",
          overview: "",
          features: [],
          includedKnowledge: [],
          supportedEnvironments: [],
          targetUsers: [],
          useCases: [],
          versionSummary: "",
          language: null,
          sourceDocuments: [
            {
              id: "d1",
              title: "Doc",
              sourceType: "FILE",
              sourceFormat: "MARKDOWN",
              sourceUrl: null,
              productVersion: "1.0",
              documentVersion: null,
              validationStatus: "PASS",
              validationSummary: null,
              validationScore: null,
              blockingIssueCount: 0,
              warningIssueCount: 0,
              validationIssues: [],
              createdAt: new Date().toISOString(),
            },
            {
              id: "d2",
              title: "Doc2",
              sourceType: "FILE",
              sourceFormat: "MARKDOWN",
              sourceUrl: null,
              productVersion: "1.0",
              documentVersion: null,
              validationStatus: "PASS",
              validationSummary: null,
              validationScore: null,
              blockingIssueCount: 0,
              warningIssueCount: 0,
              validationIssues: [],
              createdAt: new Date().toISOString(),
            },
          ],
        },
      ],
    });
    assert.equal(resolveReviewDecisionState(detail), "submit_package_changed");
    assert.notEqual(resolveReviewDecisionState(detail), "review_refresh_required");
  });

  it("Case 6: detail sections default collapsed except fail hotspots", () => {
    const open = defaultOpenAdminReviewSections(baseDetail());
    assert.equal(open.structure, false);
    assert.equal(open.chunk, false);
    assert.equal(open.retrieval, false);
    assert.equal(open.releaseGate, false);
    assert.equal(open.sources, false);
    assert.equal(open.advanced, false);

    const failOpen = defaultOpenAdminReviewSections(
      baseDetail({
        readiness: {
          versionCount: 1,
          sourceDocumentCount: 9,
          hasRequiredDescription: true,
          canApprove: false,
          pipelineStatus: "READY",
          sourceValidation: { passCount: 0, warningCount: 0, failCount: 2, notCheckedCount: 0 },
          sourceTypeCoverage: {},
          structureCoverageStatus: "PASS",
          knowledgeQualityStatus: "PASS",
          structureQualityMessage: null,
          chunkQualityStatus: "FAIL",
          chunkQualityMessage: "청킹 실패",
          retrievalEvaluationStatus: "FAIL",
          retrievalEvaluationMessage: "검색 실패",
          releaseGateStatus: "FAIL",
          releaseGateMessage: "게이트 실패",
        },
      }),
    );
    assert.equal(failOpen.chunk, true);
    assert.equal(failOpen.retrieval, true);
    assert.equal(failOpen.releaseGate, true);
    assert.equal(failOpen.sources, true);
    assert.equal(failOpen.advanced, false);
  });
});

describe("admin review decision UX wiring", () => {
  it("puts workbench panels on review detail without decision/evidence Builder actions", () => {
    const page = readSource("src/components/AdminReviewDetailPageClient.tsx");
    const accept = readSource("src/components/AdminReviewAcceptTab.tsx");
    const sources = readSource("src/components/AdminReviewSourceDocuments.tsx");

    assert.ok(!page.includes("AdminReviewAcceptTab"));
    assert.ok(!page.includes("AdminReviewEvidenceTabs"));
    assert.ok(!page.includes("AdminReviewPackageSnapshotTab"));
    assert.ok(page.includes("AdminServiceValidationWorkbenchPanel"));
    assert.ok(page.includes("AdminApprovalPublishWorkbenchPanel"));
    assert.ok(page.includes("fetchAdminWorkerZipRequestState"));
    assert.ok(!page.includes("AdminReviewAdvancedActionsTab"));
    assert.ok(!page.includes("AdminReviewDetailSections"));
    assert.ok(!page.includes("AdminReviewDecisionPanel"));
    assert.ok(!page.includes("AdminReviewInspectionSummary"));
    assert.ok(accept.includes("ADMIN_REVIEW_DECISION_TITLE"));
    assert.ok(accept.includes("ADMIN_REVIEW_CTA_ACCEPT"));
    assert.ok(accept.includes("acceptAdminReview"));
    assert.ok(accept.includes("ADMIN_REVIEW_CTA_APPROVE"));
    assert.ok(accept.includes("ADMIN_REVIEW_CTA_REJECT"));
    assert.ok(accept.includes("canApproveAdminReview"));
    assert.ok(!accept.includes("ADMIN_REVIEW_CTA_RELEASE_GATE"));
    assert.ok(!accept.includes("refreshAdminReviewReadinessApi"));
    assert.ok(!sources.includes("전체 재검증"));
    assert.ok(!sources.includes("재검증"));
    assert.ok(sources.includes("원문 보기") || sources.includes("ADMIN_REVIEW_VIEW_SOURCE"));
    assert.equal(ADMIN_REVIEW_CTA_RELEASE_GATE, "릴리스 게이트 재점검");
    assert.equal(ADMIN_REVIEW_CTA_APPROVE, "게시");
    assert.equal(ADMIN_REVIEW_CTA_REJECT, "게시 취소");
  });
});
