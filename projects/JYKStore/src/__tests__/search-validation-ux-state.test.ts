import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveDistributionStepLockMessage,
  resolveSearchDataNotReadyBanner,
  resolveSearchValidationGuidance,
  resolveSearchValidationPrimaryAction,
  resolveSearchValidationStepDisplayState,
  resolveSearchValidationWorkSteps,
  searchValidationStepStatusLabel,
} from "@/lib/search-data/search-validation-ux-state";

const passConfirmed = {
  systemStatus: "PASS",
  currentValidity: "CURRENT",
  providerConfirmationStatus: "CONFIRMED",
} as const;

const staleRun = {
  systemStatus: "STALE",
  currentValidity: "STALE",
  providerConfirmationStatus: "STALE",
} as const;

const passUnconfirmed = {
  systemStatus: "PASS",
  currentValidity: "CURRENT",
  providerConfirmationStatus: "NOT_REVIEWED",
} as const;

describe("resolveSearchValidationStepDisplayState", () => {
  it("marks ranking-policy stale VALIDATED as AUTO_EVALUATION_REQUIRED", () => {
    assert.equal(
      resolveSearchValidationStepDisplayState({
        searchDataState: "VALIDATED",
        rankingPolicyStale: true,
        api: staleRun,
        mcp: staleRun,
        download: passConfirmed,
      }),
      "AUTO_EVALUATION_REQUIRED",
    );
  });

  it("marks CURRENT auto-eval with STALE channels as SERVICE_REVALIDATION_REQUIRED", () => {
    assert.equal(
      resolveSearchValidationStepDisplayState({
        searchDataState: "VALIDATED",
        rankingPolicyStale: false,
        api: staleRun,
        mcp: staleRun,
        download: passConfirmed,
      }),
      "SERVICE_REVALIDATION_REQUIRED",
    );
  });

  it("marks PASS channels without confirmation as PROVIDER_REVIEW_REQUIRED", () => {
    assert.equal(
      resolveSearchValidationStepDisplayState({
        searchDataState: "VALIDATED",
        rankingPolicyStale: false,
        api: passUnconfirmed,
        mcp: passUnconfirmed,
        download: passConfirmed,
      }),
      "PROVIDER_REVIEW_REQUIRED",
    );
  });

  it("marks COMPLETED only when all preparation channels are ready", () => {
    assert.equal(
      resolveSearchValidationStepDisplayState({
        searchDataState: "VALIDATED",
        rankingPolicyStale: false,
        api: passConfirmed,
        mcp: passConfirmed,
        download: passConfirmed,
      }),
      "COMPLETED",
    );
  });

  it("does not treat VALIDATED alone as COMPLETED", () => {
    assert.notEqual(
      resolveSearchValidationStepDisplayState({
        searchDataState: "VALIDATED",
        rankingPolicyStale: false,
      }),
      "COMPLETED",
    );
  });
});

describe("resolveSearchValidationPrimaryAction", () => {
  it("points ranking stale to REVALIDATE_AUTO", () => {
    assert.equal(
      resolveSearchValidationPrimaryAction({
        displayState: "AUTO_EVALUATION_REQUIRED",
        searchDataState: "VALIDATED",
      }),
      "REVALIDATE_AUTO",
    );
  });

  it("points service revalidation to RUN_SERVICE_SEARCH", () => {
    assert.equal(
      resolveSearchValidationPrimaryAction({
        displayState: "SERVICE_REVALIDATION_REQUIRED",
      }),
      "RUN_SERVICE_SEARCH",
    );
  });
});

describe("resolveDistributionStepLockMessage", () => {
  it("explains auto-eval re-run when display is AUTO_EVALUATION_REQUIRED", () => {
    assert.equal(
      resolveDistributionStepLockMessage({
        displayState: "AUTO_EVALUATION_REQUIRED",
      }),
      "자동 평가 재실행이 필요합니다.",
    );
  });

  it("explains service search when display is SERVICE_REVALIDATION_REQUIRED", () => {
    assert.equal(
      resolveDistributionStepLockMessage({
        displayState: "SERVICE_REVALIDATION_REQUIRED",
      }),
      "API·MCP 검색검증이 필요합니다.",
    );
  });

  it("explains quality review when display is PROVIDER_REVIEW_REQUIRED", () => {
    assert.equal(
      resolveDistributionStepLockMessage({
        displayState: "PROVIDER_REVIEW_REQUIRED",
      }),
      "검색 결과 품질 확인이 필요합니다.",
    );
  });

  it("unlocks when COMPLETED", () => {
    assert.equal(
      resolveDistributionStepLockMessage({ displayState: "COMPLETED" }),
      null,
    );
  });
});

describe("guidance and banners", () => {
  it("uses ranking-stale guidance without regenerate copy", () => {
    const g = resolveSearchValidationGuidance({
      displayState: "AUTO_EVALUATION_REQUIRED",
      rankingPolicyStale: true,
    });
    assert.match(g.body.join(" "), /검색데이터 생성은 완료되었습니다/);
    assert.match(g.body.join(" "), /자동 검색 평가만 다시 실행/);
    assert.match(g.body.join(" "), /기존 Chunk와 Vector는 유지/);
  });

  it("fixes SEARCH_DATA_NOT_READY banner when generation is done", () => {
    assert.match(
      resolveSearchDataNotReadyBanner({
        rankingPolicyStale: true,
        searchDataState: "VALIDATED",
      }),
      /검색데이터 생성은 완료되었습니다/,
    );
    assert.doesNotMatch(
      resolveSearchDataNotReadyBanner({
        rankingPolicyStale: true,
        searchDataState: "VALIDATED",
      }),
      /검색데이터 생성과 자동 평가를 먼저/,
    );
  });

  it("labels tab status for ranking stale as 자동 평가 필요", () => {
    assert.equal(
      searchValidationStepStatusLabel("AUTO_EVALUATION_REQUIRED"),
      "자동 평가 필요",
    );
    assert.equal(
      searchValidationStepStatusLabel("SERVICE_REVALIDATION_REQUIRED"),
      "재검증 필요",
    );
  });

  it("orders work steps with current action first", () => {
    const steps = resolveSearchValidationWorkSteps("AUTO_EVALUATION_REQUIRED");
    assert.equal(steps[0]?.status, "current");
    assert.equal(steps[1]?.status, "waiting");
    assert.equal(steps[2]?.status, "waiting");
  });
});
