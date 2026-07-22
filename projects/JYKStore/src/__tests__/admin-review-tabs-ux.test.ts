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
  ADMIN_REVIEW_EVIDENCE_TAB_IDS,
  defaultAdminReviewEvidenceTab,
  isReviewAccepted,
  isReviewPending,
} from "../lib/admin-review-tabs.ts";
import {
  ADMIN_REVIEW_ACCEPT_PHASE_WARNING_TITLE,
  ADMIN_REVIEW_ACCEPT_TITLE,
  ADMIN_REVIEW_CTA_ACCEPT,
  ADMIN_REVIEW_CTA_APPROVE,
  ADMIN_REVIEW_CTA_REFRESH_ALL,
  ADMIN_REVIEW_CTA_REJECT,
  ADMIN_REVIEW_CTA_VIEW_PACKAGE,
  ADMIN_REVIEW_DECISION_TITLE,
  ADMIN_REVIEW_EVIDENCE_SECTION_TITLE,
  ADMIN_REVIEW_RECEIPT_INFO_TITLE,
  ADMIN_REVIEW_STATE_WARNING_TITLE,
  ADMIN_REVIEW_TAB_ADVANCED,
  ADMIN_REVIEW_TAB_PACKAGE,
  ADMIN_REVIEW_TAB_SERVICE_VALIDATION,
  ADMIN_REVIEW_TAB_SOURCES,
  ADMIN_REVIEW_TAB_WARNINGS,
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

  const now = new Date().toISOString();

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
      createdAt: now,
      updatedAt: now,
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
            createdAt: now,
            updatedAt: now,
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
    payload: overrides.payload ?? null,
    currentManifestFingerprint: overrides.currentManifestFingerprint ?? null,
    doclingReviewIntegrity: overrides.doclingReviewIntegrity ?? null,
    distribution: overrides.distribution ?? null,
    artifactOptions: overrides.artifactOptions ?? null,
    structureQuality: overrides.structureQuality ?? null,
    chunkQuality: overrides.chunkQuality ?? null,
    retrievalEvaluation: overrides.retrievalEvaluation ?? null,
    releaseGate: overrides.releaseGate ?? null,
  };
}

describe("admin review evidence tabs UX", () => {
  it("Case 1: evidence tabs exclude decision/accept/advanced and default to package", () => {
    const detail = baseDetail();
    assert.deepEqual([...ADMIN_REVIEW_EVIDENCE_TAB_IDS], [
      "package",
      "warnings",
      "documents",
      "processing",
      "serviceValidation",
    ]);
    assert.equal(defaultAdminReviewEvidenceTab(detail), "package");
    assert.equal(isReviewPending(detail), true);
    assert.equal(canAcceptAdminReview(detail), true);
    assert.equal(canApproveAdminReview(detail), false);

    const page = readSource("src/components/AdminReviewDetailPageClient.tsx");
    const evidence = readSource("src/components/AdminReviewEvidenceTabs.tsx");
    const accept = readSource("src/components/AdminReviewAcceptTab.tsx");
    assert.ok(!page.includes("AdminReviewAcceptTab"));
    assert.ok(!page.includes("AdminReviewEvidenceTabs"));
    assert.ok(!page.includes("ADMIN_REVIEW_EVIDENCE_SECTION_TITLE"));
    assert.ok(!page.includes("AdminReviewPackageSnapshotTab"));
    assert.ok(page.includes("AdminWorkerZipGenerationCard"));
    assert.ok(page.includes("AdminReviewReceiptInfoCard"));
    assert.ok(!page.includes("AdminReviewAdvancedActionsTab"));
    assert.ok(!page.includes('activeTab === "accept"'));
    assert.ok(!page.includes('evidenceTab === "advanced"'));
    assert.ok(!ADMIN_REVIEW_EVIDENCE_TAB_IDS.includes("accept" as never));
    assert.ok(!ADMIN_REVIEW_EVIDENCE_TAB_IDS.includes("advanced" as never));
    assert.ok(!ADMIN_REVIEW_EVIDENCE_TAB_IDS.includes("docling" as never));
    assert.ok(evidence.includes("ADMIN_REVIEW_EVIDENCE_TAB_IDS"));
    assert.ok(evidence.includes('aria-label="판단 근거"'));
    assert.ok(accept.includes("ADMIN_REVIEW_CTA_ACCEPT"));
    assert.equal(ADMIN_REVIEW_EVIDENCE_SECTION_TITLE, "판단 근거");
    assert.equal(ADMIN_REVIEW_TAB_PACKAGE, "패키지");
    assert.equal(ADMIN_REVIEW_TAB_WARNINGS, "주의");
    assert.equal(ADMIN_REVIEW_TAB_SOURCES, "문서");
    assert.equal(ADMIN_REVIEW_TAB_SERVICE_VALIDATION, "운영 로그");
    assert.equal(ADMIN_REVIEW_TAB_ADVANCED, "고급");
    assert.equal(ADMIN_REVIEW_CTA_ACCEPT, "검수 접수");
  });

  it("Case 2: PENDING WARNING uses accept-phase copy, not approval copy", () => {
    const detail = baseDetail();
    const copy = resolvePendingAcceptCopy(detail);
    assert.equal(copy.title, ADMIN_REVIEW_ACCEPT_PHASE_WARNING_TITLE);
    assert.notEqual(copy.title, ADMIN_REVIEW_STATE_WARNING_TITLE);
  });

  it("Case 3: package snapshot Run ID only on package tab", () => {
    const accept = readSource("src/components/AdminReviewAcceptTab.tsx");
    const packageTab = readSource("src/components/AdminReviewPackageSnapshotTab.tsx");
    assert.ok(!accept.includes("retrievalEvaluationRunId"));
    assert.ok(!accept.includes("검색 평가 Run"));
    assert.ok(packageTab.includes("retrievalEvaluationRunId"));
    assert.ok(packageTab.includes("검색 평가 Run"));
  });

  it("Case 4/5: review detail keeps worker zip + receipt; decision/evidence cards removed", () => {
    const page = readSource("src/components/AdminReviewDetailPageClient.tsx");
    assert.ok(!page.includes("AdminReviewAcceptTab"));
    assert.ok(!page.includes("AdminReviewEvidenceTabs"));
    assert.ok(!page.includes("AdminReviewPackageSnapshotTab"));
    assert.ok(page.includes("AdminWorkerZipGenerationCard"));
    assert.ok(page.includes("AdminReviewReceiptInfoCard"));
    assert.ok(page.includes("isReviewAccepted(detail)"));

    const accept = readSource("src/components/AdminReviewAcceptTab.tsx");
    assert.ok(accept.includes("ADMIN_REVIEW_DECISION_TITLE"));
    assert.ok(accept.includes("ADMIN_REVIEW_ACCEPT_TITLE"));
    assert.ok(accept.includes("ADMIN_REVIEW_CTA_APPROVE"));
    assert.ok(accept.includes("showDecisionActions"));
    assert.equal(ADMIN_REVIEW_DECISION_TITLE, "최종 검수 판단");
    assert.equal(ADMIN_REVIEW_ACCEPT_TITLE, "검수 요청 접수");

    const receipt = readSource("src/components/AdminReviewReceiptInfoCard.tsx");
    assert.ok(receipt.includes("ADMIN_REVIEW_RECEIPT_INFO_TITLE"));
    assert.ok(!receipt.includes("ADMIN_REVIEW_CTA_VIEW_PACKAGE"));
    assert.ok(!receipt.includes("onGoToPackageTab"));
    assert.equal(ADMIN_REVIEW_RECEIPT_INFO_TITLE, "접수 정보");
    assert.equal(ADMIN_REVIEW_CTA_VIEW_PACKAGE, "제출 패키지 보기");
  });

  it("Case 5: package evidence tab is no longer mounted on review detail", () => {
    const page = readSource("src/components/AdminReviewDetailPageClient.tsx");
    assert.ok(!page.includes('setEvidenceTab("package")'));
    assert.ok(!page.includes("onGoToPackageTab"));
    assert.ok(!page.includes("AdminReviewPackageSnapshotTab"));
  });

  it("Case 6: advanced refresh tab is not mounted after Builder freeze", () => {
    const page = readSource("src/components/AdminReviewDetailPageClient.tsx");
    const accept = readSource("src/components/AdminReviewAcceptTab.tsx");
    assert.ok(!page.includes("AdminReviewAdvancedActionsTab"));
    assert.ok(!page.includes('evidenceTab === "advanced"'));
    assert.ok(!accept.includes("ADMIN_REVIEW_CTA_REFRESH_ALL"));
    assert.ok(!accept.includes("refreshAdminReviewReadinessApi"));
    assert.equal(ADMIN_REVIEW_CTA_REFRESH_ALL, "현재 데이터 기준 전체 재점검");
  });

  it("Case 7: source document body collapsed by default", () => {
    const sources = readSource("src/components/AdminReviewSourceDocuments.tsx");
    assert.ok(sources.includes("ADMIN_REVIEW_VIEW_SOURCE"));
    assert.ok(sources.includes("ADMIN_REVIEW_VIEW_VALIDATION"));
    assert.ok(sources.includes("previewOpen && doc.contentPreview"));
  });

  it("Case 8: IN_REVIEW shows decision actions and receipt eligibility", () => {
    const now = new Date().toISOString();
    const detail = baseDetail({
      latestReview: {
        id: "rev-accepted",
        status: "IN_REVIEW",
        decision: null,
        memo: null,
        rejectionReason: null,
        reviewerUserId: "admin-1",
        createdAt: now,
        updatedAt: now,
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
    assert.equal(isReviewAccepted(detail), true);
    assert.equal(isReviewPending(detail), false);
    assert.equal(canAcceptAdminReview(detail), false);

    const accept = readSource("src/components/AdminReviewAcceptTab.tsx");
    assert.ok(accept.includes("ADMIN_REVIEW_CTA_APPROVE"));
    assert.ok(accept.includes("ADMIN_REVIEW_CTA_REJECT"));
    assert.equal(ADMIN_REVIEW_CTA_APPROVE, "승인 및 공개");
    assert.equal(ADMIN_REVIEW_CTA_REJECT, "반려");
  });
});
