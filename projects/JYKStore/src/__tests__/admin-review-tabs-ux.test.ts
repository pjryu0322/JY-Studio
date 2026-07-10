import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { AdminReviewDetailDto } from "../lib/admin-review-dto.ts";
import {
  canAcceptAdminReview,
  canApproveAdminReview,
  resolvePendingAcceptCopy,
} from "../lib/admin-review-decision.ts";
import {
  adminReviewAcceptTabLabel,
  defaultAdminReviewTab,
} from "../lib/admin-review-tabs.ts";
import {
  ADMIN_REVIEW_ACCEPT_PHASE_WARNING_TITLE,
  ADMIN_REVIEW_CTA_ACCEPT,
  ADMIN_REVIEW_CTA_APPROVE,
  ADMIN_REVIEW_CTA_REFRESH_ALL,
  ADMIN_REVIEW_CTA_REJECT,
  ADMIN_REVIEW_STATE_WARNING_TITLE,
  ADMIN_REVIEW_TAB_ACCEPT,
  ADMIN_REVIEW_TAB_DECISION,
} from "../lib/role-based-ux-copy.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

function baseDetail(overrides: Partial<AdminReviewDetailDto> = {}): AdminReviewDetailDto {
  const readiness = {
    versionCount: 1,
    sourceDocumentCount: 10,
    hasRequiredDescription: true,
    canApprove: true,
    pipelineStatus: "READY",
    sourceValidation: {
      passCount: 6,
      warningCount: 4,
      failCount: 0,
      notCheckedCount: 0,
    },
    sourceTypeCoverage: {},
    structureCoverageStatus: "WARNING",
    knowledgeQualityStatus: "WARNING",
    structureQualityMessage: null,
    chunkQualityStatus: "PASS",
    chunkQualityMessage: null,
    retrievalEvaluationStatus: "PASS",
    retrievalEvaluationMessage: null,
    releaseGateStatus: "WARNING" as string | null,
    releaseGateMessage: null,
    ...(overrides.readiness ?? {}),
  };

  return {
    pack: {
      packId: "pack-1",
      name: "TOAST UI Grid",
      providerName: "JYK001",
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
            id: "rev-pending",
            status: "PENDING",
            decision: null,
            memo: null,
            rejectionReason: null,
            reviewerUserId: null,
            createdAt: new Date().toISOString(),
            decidedAt: null,
            submitSnapshot: {
              submittedAt: "2026-07-10T13:38:00.000Z",
              submittedVersionId: "ver-1",
              sourceDocumentCount: 10,
              sourceDocumentIds: [],
              activeChunkIds: [],
              activeChunkCount: 10,
              retrievalEvaluationRunId: "cmreze8i9002uun08tsrmz0zw",
              releaseGateRunId: "rg-1",
              releaseGateStatus: "WARNING",
              warnings: ["원천 문서 4개가 WARNING 상태입니다."],
            },
          }
        : overrides.latestReview,
    readiness,
    structureQuality: overrides.structureQuality ?? null,
    chunkQuality: overrides.chunkQuality ?? null,
    retrievalEvaluation: overrides.retrievalEvaluation ?? null,
    releaseGate: overrides.releaseGate ?? null,
  };
}

describe("admin review tabs UX", () => {
  it("Case 1: PENDING defaults to accept tab with accept CTA wiring", () => {
    const detail = baseDetail();
    assert.equal(defaultAdminReviewTab(detail), "accept");
    assert.equal(adminReviewAcceptTabLabel(detail), ADMIN_REVIEW_TAB_ACCEPT);
    assert.equal(canAcceptAdminReview(detail), true);
    assert.equal(canApproveAdminReview(detail), false);

    const page = readSource("src/components/AdminReviewDetailPageClient.tsx");
    const accept = readSource("src/components/AdminReviewAcceptTab.tsx");
    assert.ok(page.includes("AdminReviewTabs"));
    assert.ok(page.includes('activeTab === "accept"'));
    assert.ok(page.includes("AdminReviewAcceptTab"));
    assert.ok(!page.includes("AdminReviewInspectionSummary"));
    assert.ok(!page.includes("AdminReviewNeedsAttention"));
    assert.ok(accept.includes("ADMIN_REVIEW_CTA_ACCEPT"));
    assert.ok(accept.includes("acceptAdminReview"));
    assert.ok(accept.includes("showDecisionActions"));
    assert.ok(accept.includes("isAccepted"));
    assert.equal(ADMIN_REVIEW_CTA_ACCEPT, "검수 접수");
  });

  it("Case 2: PENDING WARNING uses accept-phase copy, not approval copy", () => {
    const detail = baseDetail();
    const copy = resolvePendingAcceptCopy(detail);
    assert.equal(copy.title, ADMIN_REVIEW_ACCEPT_PHASE_WARNING_TITLE);
    assert.equal(copy.title, "접수 가능 · 주의 항목 있음");
    assert.notEqual(copy.title, ADMIN_REVIEW_STATE_WARNING_TITLE);
    assert.notEqual(copy.title, "주의 후 승인 가능");
  });

  it("Case 3: package snapshot Run ID only on package tab", () => {
    const accept = readSource("src/components/AdminReviewAcceptTab.tsx");
    const packageTab = readSource("src/components/AdminReviewPackageSnapshotTab.tsx");
    assert.ok(!accept.includes("retrievalEvaluationRunId"));
    assert.ok(!accept.includes("검색 평가 Run"));
    assert.ok(packageTab.includes("retrievalEvaluationRunId"));
    assert.ok(packageTab.includes("검색 평가 Run"));
  });

  it("Case 5: advanced refresh hidden on default tab", () => {
    const page = readSource("src/components/AdminReviewDetailPageClient.tsx");
    const accept = readSource("src/components/AdminReviewAcceptTab.tsx");
    const advanced = readSource("src/components/AdminReviewAdvancedActionsTab.tsx");
    assert.ok(page.includes('activeTab === "advanced"'));
    assert.ok(!accept.includes("ADMIN_REVIEW_CTA_REFRESH_ALL"));
    assert.ok(!accept.includes("refreshAdminReviewReadinessApi"));
    assert.ok(advanced.includes("ADMIN_REVIEW_CTA_REFRESH_ALL"));
    assert.ok(advanced.includes("refreshAdminReviewReadinessApi"));
    assert.equal(ADMIN_REVIEW_CTA_REFRESH_ALL, "현재 데이터 기준 전체 재점검");
  });

  it("Case 6: source document body collapsed by default", () => {
    const sources = readSource("src/components/AdminReviewSourceDocuments.tsx");
    assert.ok(sources.includes("ADMIN_REVIEW_VIEW_SOURCE"));
    assert.ok(sources.includes("ADMIN_REVIEW_VIEW_VALIDATION"));
    assert.ok(sources.includes("previewOpen"));
    assert.ok(sources.includes("contentPreview"));
    assert.ok(sources.includes("previewOpen && doc.contentPreview"));
  });

  it("Case 7: IN_REVIEW defaults to decision tab label and approve actions", () => {
    const detail = baseDetail({
      latestReview: {
        id: "rev-accepted",
        status: "IN_REVIEW",
        decision: null,
        memo: null,
        rejectionReason: null,
        reviewerUserId: "admin-1",
        createdAt: new Date().toISOString(),
        decidedAt: null,
        submitSnapshot: {
          submittedAt: "2026-07-10T13:38:00.000Z",
          submittedVersionId: "ver-1",
          sourceDocumentCount: 10,
          sourceDocumentIds: [],
          activeChunkIds: [],
          activeChunkCount: 10,
          retrievalEvaluationRunId: "cmreze8i9002uun08tsrmz0zw",
          releaseGateRunId: "rg-1",
          releaseGateStatus: "WARNING",
          warnings: [],
        },
      },
    });
    assert.equal(defaultAdminReviewTab(detail), "accept");
    assert.equal(adminReviewAcceptTabLabel(detail), ADMIN_REVIEW_TAB_DECISION);
    assert.equal(canAcceptAdminReview(detail), false);

    const accept = readSource("src/components/AdminReviewAcceptTab.tsx");
    assert.ok(accept.includes("ADMIN_REVIEW_CTA_APPROVE"));
    assert.ok(accept.includes("ADMIN_REVIEW_CTA_REJECT"));
    assert.equal(ADMIN_REVIEW_CTA_APPROVE, "승인 및 공개");
    assert.equal(ADMIN_REVIEW_CTA_REJECT, "반려");
  });
});
