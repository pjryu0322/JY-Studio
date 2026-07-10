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
  ADMIN_REVIEW_DECISION_TITLE,
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
    latestReview: overrides.latestReview ?? null,
    readiness,
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
  it("puts decision summary first and collapses detail tools", () => {
    const page = readSource("src/components/AdminReviewDetailPageClient.tsx");
    const decision = readSource("src/components/AdminReviewDecisionSummary.tsx");
    const sections = readSource("src/components/AdminReviewDetailSections.tsx");
    const sources = readSource("src/components/AdminReviewSourceDocuments.tsx");

    assert.ok(page.includes("AdminReviewDecisionSummary"));
    assert.ok(page.includes("AdminReviewInspectionSummary"));
    assert.ok(page.includes("AdminReviewNeedsAttention"));
    assert.ok(page.includes("AdminReviewDetailSections"));
    assert.ok(!page.includes("AdminReviewDecisionPanel"));
    assert.ok(decision.includes("ADMIN_REVIEW_DECISION_TITLE"));
    assert.ok(decision.includes("ADMIN_REVIEW_CTA_RELEASE_GATE"));
    assert.ok(decision.includes("ADMIN_REVIEW_CTA_REFRESH_ALL"));
    assert.ok(decision.includes("refreshAdminReviewReadinessApi"));
    assert.ok(decision.includes("ADMIN_REVIEW_CTA_APPROVE"));
    assert.ok(decision.includes("ADMIN_REVIEW_CTA_REJECT"));
    assert.ok(decision.includes("canApproveAdminReview"));
    assert.ok(sections.includes("구조/품질 상세 보기"));
    assert.ok(sections.includes("고급 도구"));
    assert.ok(sections.includes("<details"));
    assert.ok(sources.includes("원문 보기"));
    assert.equal(ADMIN_REVIEW_DECISION_TITLE, "최종 검수 판단");
    assert.equal(ADMIN_REVIEW_CTA_RELEASE_GATE, "릴리스 게이트 최종 점검");
    assert.equal(ADMIN_REVIEW_CTA_APPROVE, "승인 및 공개");
    assert.equal(ADMIN_REVIEW_CTA_REJECT, "반려");
  });
});
