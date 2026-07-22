import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AdminReviewDetailDto } from "../lib/admin-review-dto.ts";
import {
  buildAdminQualityGateSnapshot,
  getAdminReviewRailState,
  getNextReviewAction,
} from "../lib/role-workspace/admin-review-rail.ts";
import { getConsumerRailState } from "../lib/role-workspace/consumer-rail.ts";
import { getProviderPackRailState } from "../lib/role-workspace/provider-pack-rail.ts";

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
      status: "DRAFT",
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
    latestReview: overrides.latestReview === undefined ? null : overrides.latestReview,
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

describe("getNextReviewAction", () => {
  it("shows search-validation CTA when quality passed with fail 0 and no blockers", () => {
    const detail = baseDetail();
    const quality = buildAdminQualityGateSnapshot(detail);
    const action = getNextReviewAction({
      workerZipPhase: "COMPLETED",
      quality,
      searchValidationDone: false,
      detail,
    });
    assert.equal(action.kind, "GO_SEARCH_VALIDATION");
    assert.equal(action.primaryLabel, "검색데이터 생성 및 검증으로 이동");
    assert.equal(action.secondaryLabel, "품질 점검 다시 실행");
    assert.match(action.message, /차단 이슈가 없습니다/);
  });

  it("does not block next step when only warnings exist", () => {
    const detail = baseDetail({
      readiness: {
        versionCount: 1,
        sourceDocumentCount: 9,
        hasRequiredDescription: true,
        canApprove: true,
        pipelineStatus: "READY",
        sourceValidation: {
          passCount: 4,
          warningCount: 2,
          failCount: 0,
          notCheckedCount: 0,
        },
        sourceTypeCoverage: {},
        structureCoverageStatus: "PASS",
        knowledgeQualityStatus: "WARNING",
        structureQualityMessage: null,
        chunkQualityStatus: "PASS",
        chunkQualityMessage: null,
        retrievalEvaluationStatus: "WARNING",
        retrievalEvaluationMessage: null,
        releaseGateStatus: "PASS",
        releaseGateMessage: null,
      },
    });
    const quality = buildAdminQualityGateSnapshot(detail);
    assert.equal(quality.hasWarnings, true);
    assert.equal(quality.hasBlockers, false);
    const action = getNextReviewAction({
      workerZipPhase: "COMPLETED",
      quality,
      searchValidationDone: false,
      detail,
    });
    assert.equal(action.kind, "GO_SEARCH_VALIDATION");
    assert.equal(action.tone, "warning");
    assert.match(action.message, /WARNING/);

    const rail = getAdminReviewRailState({
      packId: "pack-1",
      workerZipPhase: "COMPLETED",
      quality,
      searchValidationDone: false,
      detail,
      activeStep: "quality",
    });
    const search = rail.items.find((i) => i.id === "searchValidation");
    assert.ok(search);
    assert.notEqual(search.status, "blocked");
  });

  it("blocks next step and surfaces reasons when blocking issues exist", () => {
    const detail = baseDetail({
      readiness: {
        versionCount: 1,
        sourceDocumentCount: 9,
        hasRequiredDescription: true,
        canApprove: false,
        pipelineStatus: "READY",
        sourceValidation: {
          passCount: 1,
          warningCount: 0,
          failCount: 2,
          notCheckedCount: 0,
        },
        sourceTypeCoverage: {},
        structureCoverageStatus: "FAIL",
        knowledgeQualityStatus: "FAIL",
        structureQualityMessage: "구조 실패",
        chunkQualityStatus: "FAIL",
        chunkQualityMessage: null,
        retrievalEvaluationStatus: "FAIL",
        retrievalEvaluationMessage: null,
        releaseGateStatus: "FAIL",
        releaseGateMessage: "게이트 실패",
      },
    });
    const quality = buildAdminQualityGateSnapshot(detail);
    assert.equal(quality.hasBlockers, true);
    const action = getNextReviewAction({
      workerZipPhase: "COMPLETED",
      quality,
      searchValidationDone: false,
      detail,
    });
    assert.equal(action.kind, "REGENERATE_KNOWLEDGE");
    assert.equal(action.tone, "blocked");
    assert.ok((action.blockedReasons?.length ?? 0) > 0);

    const rail = getAdminReviewRailState({
      packId: "pack-1",
      workerZipPhase: "COMPLETED",
      quality,
      searchValidationDone: false,
      detail,
      activeStep: "quality",
    });
    const search = rail.items.find((i) => i.id === "searchValidation");
    assert.equal(search?.status, "blocked");
    assert.ok(search?.blockedReason);
  });

  it("shows final-decision CTA after search validation is done", () => {
    const detail = baseDetail();
    const quality = buildAdminQualityGateSnapshot(detail);
    const action = getNextReviewAction({
      workerZipPhase: "COMPLETED",
      quality,
      searchValidationDone: true,
      detail,
    });
    assert.equal(action.kind, "GO_FINAL_DECISION");
    assert.equal(action.primaryLabel, "최종 검수 판단으로 이동");
  });
});

describe("getProviderPackRailState", () => {
  it("lists workflow steps in order", () => {
    const items = getProviderPackRailState({
      packId: "pack-1",
      activeTab: "basic",
      pack: null,
    });
    const labels = items.map((i) => i.label);
    assert.deepEqual(labels, [
      "내 지식팩",
      "기본정보",
      "자료등록",
      "데이터 구조화",
      "검색데이터 생성·검증",
      "유통정보·검수요청",
      "검수결과",
    ]);
    assert.equal(items.find((i) => i.id === "basic")?.status, "current");
    assert.equal(items.find((i) => i.id === "payload")?.status, "next");
  });

  it("keeps locked steps visible with blocked reason", () => {
    const items = getProviderPackRailState({
      packId: "pack-1",
      activeTab: "serviceValidation",
      pack: null,
      tabLocks: {
        distributionReview: {
          locked: true,
          reason: "검색데이터 검증을 완료하면 열립니다.",
        },
      },
    });
    const dist = items.find((i) => i.id === "distributionReview");
    assert.equal(dist?.status, "blocked");
    assert.equal(dist?.blockedReason, "검색데이터 검증을 완료하면 열립니다.");
    assert.ok(dist?.href);
  });
});

describe("getConsumerRailState", () => {
  it("does not expose admin or provider workflow labels", () => {
    const items = getConsumerRailState({ activeId: "explore" });
    const labels = items.map((i) => i.label).join(" ");
    assert.equal(labels.includes("검수"), false);
    assert.equal(labels.includes("접수"), false);
    assert.equal(labels.includes("제공자"), false);
    assert.ok(items.some((i) => i.id === "explore"));
    assert.ok(items.some((i) => i.id === "apiKeys"));
  });
});
