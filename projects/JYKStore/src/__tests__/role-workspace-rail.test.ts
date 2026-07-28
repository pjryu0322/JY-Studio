import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { AdminReviewDetailDto } from "../lib/admin-review-dto.ts";
import {
  buildAdminQualityGateSnapshot,
  getAdminReviewRailState,
  getNextReviewAction,
} from "../lib/role-workspace/admin-review-rail.ts";
import { getConsumerRailState } from "../lib/role-workspace/consumer-rail.ts";
import { getProviderPackRailState } from "../lib/role-workspace/provider-pack-rail.ts";

const here = dirname(fileURLToPath(import.meta.url));

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
              createdAt: new Date().toISOString(),
              finishedAt: new Date().toISOString(),
            },
            freshness: {
              status: "CURRENT",
              reason: null,
              reasonCode: null,
              checkedAt: new Date().toISOString(),
              versionId: null,
            },
          }
        : overrides.releaseGate,
  };
}

describe("getNextReviewAction", () => {
  it("routes to service validation after quality passed (before provider review)", () => {
    const detail = baseDetail();
    const quality = buildAdminQualityGateSnapshot(detail);
    const action = getNextReviewAction({
      workerZipPhase: "COMPLETED",
      quality,
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
      detail,
    });
    assert.equal(action.kind, "GO_SERVICE_VALIDATION");
    assert.equal(action.primaryLabel, "서비스 검증으로 이동");
  });

  it("hides provider-review CTA when knowledge generation is not completed", () => {
    const detail = baseDetail();
    const quality = buildAdminQualityGateSnapshot(detail);
    const action = getNextReviewAction({
      workerZipPhase: "ACCEPTED",
      quality,
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
      detail,
    });
    assert.equal(action.kind, "NONE");
    assert.match(action.message, /지식데이터 생성|접수|대상/);
  });

  it("does not unlock provider review before service validation passes", () => {
    const detail = baseDetail();
    const quality = buildAdminQualityGateSnapshot(detail);
    const action = getNextReviewAction({
      workerZipPhase: "COMPLETED",
      quality,
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
      detail,
    });
    assert.equal(action.kind, "GO_SERVICE_VALIDATION");
    assert.notEqual(action.kind, "REQUEST_PROVIDER_REVIEW");

    const rail = getAdminReviewRailState({
      packId: "pack-1",
      workerZipPhase: "COMPLETED",
      quality,
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
      detail,
      activeStep: "serviceValidation",
    });
    const publish = rail.items.find((i) => i.id === "publish");
    assert.ok(publish);
    assert.ok(publish.status === "blocked" || publish.status === "next" || publish.status === "current");
  });

  it("requests provider review after service validation passes", () => {
    const detail = baseDetail();
    const quality = buildAdminQualityGateSnapshot(detail);
    const action = getNextReviewAction({
      workerZipPhase: "COMPLETED",
      quality,
      providerReviewPhase: "NONE",
      serviceValidationPhase: "PASSED",
      detail,
    });
    assert.equal(action.kind, "REQUEST_PROVIDER_REVIEW");
    assert.equal(action.primaryLabel, "제공자 검토 요청");
  });

  it("shows final-decision CTA after service validation and provider confirm", () => {
    const detail = baseDetail();
    const quality = buildAdminQualityGateSnapshot(detail);
    const action = getNextReviewAction({
      workerZipPhase: "COMPLETED",
      quality,
      providerReviewPhase: "CONFIRMED",
      serviceValidationPhase: "PASSED",
      detail,
    });
    assert.equal(action.kind, "GO_FINAL_DECISION");
    assert.equal(action.primaryLabel, "게시 단계로 이동");
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
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
      detail,
    });
    assert.equal(action.kind, "REGENERATE_KNOWLEDGE");
    assert.equal(action.tone, "blocked");
    assert.ok((action.blockedReasons?.length ?? 0) > 0);
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
      "처리요청",
      "관리자 처리상태",
      "검토 요청",
      "검수 상태",
      "공개 정보",
      "사용 통계",
    ]);
    assert.equal(items.find((i) => i.id === "basic")?.status, "current");
  });

  it("badges generation review when provider review is requested", () => {
    const items = getProviderPackRailState({
      packId: "pack-1",
      activeTab: "knowledge",
      pack: {
        providerReviewPhase: "REQUESTED",
        adminGenerationHold: "COMPLETED",
      } as never,
    });
    const review = items.find((i) => i.id === "generationReview");
    assert.equal(review?.label, "검토 요청");
    assert.equal(review?.badge, "1");
    assert.ok(review?.status === "current" || review?.status === "next");
  });

  it("keeps locked steps visible with blocked reason", () => {
    const items = getProviderPackRailState({
      packId: "pack-1",
      activeTab: "payload",
      pack: null,
      tabLocks: {
        payload: {
          locked: true,
          reason: "관리자 처리 중에는 자료를 수정할 수 없습니다.",
        },
      },
    });
    const payload = items.find((i) => i.id === "payload");
    assert.equal(payload?.status, "blocked");
    assert.equal(payload?.blockedReason, "관리자 처리 중에는 자료를 수정할 수 없습니다.");
    assert.ok(payload?.href);
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

describe("RoleRailIcon admin stages", () => {
  it("defines distinct icons for generation, quality, and correction", () => {
    const src = readFileSync(
      join(here, "../components/role-workspace/RoleRailIcon.tsx"),
      "utf8",
    );
    assert.ok(src.includes('case "generation"'));
    assert.ok(src.includes('case "quality"'));
    assert.ok(src.includes('case "correction"'));
  });
});
