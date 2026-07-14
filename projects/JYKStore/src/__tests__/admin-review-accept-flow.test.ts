import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { AdminReviewDetailDto } from "../lib/admin-review-dto.ts";
import {
  canAcceptAdminReview,
  canApproveAdminReview,
  canRejectWithoutAccept,
  collectAcceptBlockers,
} from "../lib/admin-review-decision.ts";
import { ADMIN_REVIEW_CTA_ACCEPT } from "../lib/role-based-ux-copy.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

function pendingDetail(
  overrides: Partial<AdminReviewDetailDto> = {},
): AdminReviewDetailDto {
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
            id: "rev-1",
            status: "PENDING",
            decision: null,
            memo: null,
            rejectionReason: null,
            reviewerUserId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            decidedAt: null,
            submitSnapshot: {
              submittedAt: "2026-07-10T13:38:00.000Z",
              submittedVersionId: "ver-1",
              sourceDocumentCount: 10,
              sourceDocumentIds: [],
              activeChunkIds: [],
              activeChunkCount: 10,
              retrievalEvaluationRunId: "run-1",
              releaseGateRunId: "rg-1",
              releaseGateStatus: "PASS",
              warnings: [],
            },
          }
        : overrides.latestReview,
    readiness: {
      versionCount: 1,
      sourceDocumentCount: 10,
      hasRequiredDescription: true,
      canApprove: true,
      pipelineStatus: "READY",
      sourceValidation: {
        passCount: 10,
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
      releaseGateStatus: "PASS",
      releaseGateMessage: null,
      ...(overrides.readiness ?? {}),
    },
    payload: overrides.payload ?? null,
    currentManifestFingerprint: overrides.currentManifestFingerprint ?? null,
    doclingReviewIntegrity: overrides.doclingReviewIntegrity ?? null,
    distribution: overrides.distribution ?? null,
    artifactOptions: overrides.artifactOptions ?? null,
    structureQuality: null,
    chunkQuality: null,
    retrievalEvaluation: null,
    releaseGate: null,
  };
}

describe("admin review accept flow", () => {
  it("Case 4: PENDING accept enables approve only after IN_REVIEW", () => {
    const pending = pendingDetail();
    assert.equal(canAcceptAdminReview(pending), true);
    assert.equal(canApproveAdminReview(pending), false);

    const accepted = pendingDetail({
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
          submittedAt: "2026-07-10T13:38:00.000Z",
          submittedVersionId: "ver-1",
          sourceDocumentCount: 10,
          sourceDocumentIds: [],
          activeChunkIds: [],
          activeChunkCount: 10,
          retrievalEvaluationRunId: "run-1",
          releaseGateRunId: "rg-1",
          releaseGateStatus: "PASS",
          warnings: [],
        },
      },
    });
    assert.equal(canAcceptAdminReview(accepted), false);
    assert.equal(canApproveAdminReview(accepted), true);

    const acceptTab = readSource("src/components/AdminReviewAcceptTab.tsx");
    const api = readSource("src/lib/admin-review-api.ts");
    const service = readSource("src/lib/admin-review-service.ts");
    assert.ok(acceptTab.includes("acceptAdminReview"));
    assert.ok(acceptTab.includes("ADMIN_REVIEW_CTA_ACCEPT"));
    assert.ok(api.includes("/accept"));
    assert.ok(service.includes("acceptPackReview"));
    assert.ok(service.includes("PackReviewStatus.IN_REVIEW"));
    assert.equal(ADMIN_REVIEW_CTA_ACCEPT, "검수 접수");
  });

  it("allows reject without accept only when submit package is blocked", () => {
    const ok = pendingDetail();
    assert.equal(canRejectWithoutAccept(ok), false);

    const blocked = pendingDetail({
      latestReview: {
        id: "rev-1",
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
    assert.equal(canAcceptAdminReview(blocked), false);
    assert.equal(canRejectWithoutAccept(blocked), true);
    assert.ok(collectAcceptBlockers(blocked).includes("제출 스냅샷이 없습니다."));

    const service = readSource("src/lib/admin-review-service.ts");
    assert.ok(service.includes("canRejectWithoutAccept"));
  });
});
