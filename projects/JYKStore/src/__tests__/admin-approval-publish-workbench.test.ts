import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { buildAdminApprovalPublishViewModel } from "../lib/role-workspace/admin-approval-publish-view-model.ts";
import { buildAdminQualityGateSnapshot } from "../lib/role-workspace/admin-review-rail.ts";
import type { AdminReviewDetailDto } from "../lib/admin-review-dto.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

function minimalDetail(status: string): AdminReviewDetailDto {
  return {
    pack: {
      id: "p1",
      name: "Pack",
      status,
      providerName: "Provider",
      categoryId: null,
      categoryName: null,
      versionLabel: null,
    },
    versions: [],
    readiness: {
      canApprove: true,
      structureCoverageStatus: "PASS",
      chunkQualityStatus: "PASS",
      retrievalEvaluationStatus: "PASS",
      releaseGateStatus: "PASS",
      knowledgeQualityStatus: "PASS",
      sourceValidation: { passCount: 1, warningCount: 0, failCount: 0, notCheckedCount: 0 },
    },
    latestReview: null,
    distribution: null,
    payload: null,
  } as unknown as AdminReviewDetailDto;
}

const qualityOk = {
  ...buildAdminQualityGateSnapshot(null),
  completed: true,
  hasBlockers: false,
  failCount: 0,
  hasWarnings: false,
  blockers: [] as string[],
  warnings: [] as string[],
};

describe("admin approval publish hardening", () => {
  it("blocks even when legacy readiness.canApprove is true without provider confirm", () => {
    const detail = minimalDetail("REVIEWING");
    assert.equal(detail.readiness.canApprove, true);
    const vm = buildAdminApprovalPublishViewModel({
      detail,
      providerConfirmed: false,
      serviceDone: true,
      openSupplement: false,
      quality: qualityOk,
      workerZipPhase: "COMPLETED",
    });
    assert.equal(vm.canDecide, false);
    assert.equal(vm.status, "BLOCKED");
  });

  it("blocks even when legacy readiness.canApprove is true without serviceDone", () => {
    const detail = minimalDetail("REVIEWING");
    const vm = buildAdminApprovalPublishViewModel({
      detail,
      providerConfirmed: true,
      serviceDone: false,
      openSupplement: false,
      quality: qualityOk,
      workerZipPhase: "COMPLETED",
    });
    assert.equal(vm.canDecide, false);
    assert.ok(vm.blockedReasons.some((r) => r.includes("서비스 검증")));
    assert.ok(vm.remediationActions.some((a) => a.id === "serviceValidation"));
  });

  it("blocks open supplement and incomplete worker zip", () => {
    const open = buildAdminApprovalPublishViewModel({
      detail: minimalDetail("REVIEWING"),
      providerConfirmed: true,
      serviceDone: true,
      openSupplement: true,
      quality: qualityOk,
      workerZipPhase: "COMPLETED",
    });
    assert.equal(open.canDecide, false);
    assert.ok(open.remediationActions.some((a) => a.id === "correction"));

    const zip = buildAdminApprovalPublishViewModel({
      detail: minimalDetail("REVIEWING"),
      providerConfirmed: true,
      serviceDone: true,
      openSupplement: false,
      quality: qualityOk,
      workerZipPhase: "PROCESSING",
    });
    assert.equal(zip.canDecide, false);
    assert.ok(zip.remediationActions.some((a) => a.id === "generation"));
  });

  it("allows decide only when all workflow gates pass", () => {
    const vm = buildAdminApprovalPublishViewModel({
      detail: minimalDetail("REVIEWING"),
      providerConfirmed: true,
      serviceDone: true,
      openSupplement: false,
      quality: qualityOk,
      workerZipPhase: "COMPLETED",
    });
    assert.equal(vm.canDecide, true);
    assert.equal(vm.status, "READY_TO_DECIDE");
    assert.equal(vm.remediationActions.length, 0);
  });

  it("distinguishes PUBLISHED vs VERIFIED", () => {
    const published = buildAdminApprovalPublishViewModel({
      detail: minimalDetail("PUBLISHED"),
      providerConfirmed: true,
      serviceDone: true,
      openSupplement: false,
      quality: qualityOk,
      workerZipPhase: "COMPLETED",
    });
    assert.equal(published.status, "PUBLISHED");
    assert.match(published.summaryMessage, /공개/);

    const verified = buildAdminApprovalPublishViewModel({
      detail: minimalDetail("VERIFIED"),
      providerConfirmed: true,
      serviceDone: true,
      openSupplement: false,
      quality: qualityOk,
      workerZipPhase: "COMPLETED",
    });
    assert.equal(verified.status, "VERIFIED");
    assert.match(verified.summaryMessage, /검증 완료/);
    assert.equal(verified.canDecide, false);
  });

  it("gates AdminReviewAcceptTab on vm.canDecide (not REVIEWING alone)", () => {
    const panel = readSource("src/components/AdminApprovalPublishWorkbenchPanel.tsx");
    assert.ok(panel.includes("showDecisionForm"));
    assert.ok(panel.includes("vm.canDecide && detail.pack.status === \"REVIEWING\""));
    assert.ok(!panel.includes("vm.canDecide || detail.pack.status === \"REVIEWING\""));
    assert.ok(panel.includes("remediationActions"));
    assert.ok(panel.includes("onGoProviderReview"));
    assert.ok(panel.includes("onGoServiceValidation"));
    assert.ok(panel.includes("보정 없음"));
    assert.ok(panel.includes("게시"));
  });

  it("wires remediation CTAs from detail page", () => {
    const detail = readSource("src/components/AdminReviewDetailPageClient.tsx");
    assert.ok(detail.includes("onGoGeneration"));
    assert.ok(detail.includes("onGoQuality"));
    assert.ok(detail.includes("onGoProviderReview"));
    assert.ok(detail.includes("onGoServiceValidation"));
  });

  it("approvePackReview still gates open supplement and store workflow", () => {
    const service = readSource("src/lib/admin-review-service.ts");
    assert.ok(service.includes("PROVIDER_SUPPLEMENT_OPEN"));
    assert.ok(service.includes("SERVICE_VALIDATION_REQUIRED"));
    assert.ok(service.includes("PROVIDER_CONFIRM_REQUIRED"));
    assert.ok(service.includes("assertProviderReviewBindingCurrent"));
    assert.ok(service.includes("UNRESOLVED_CORRECTION"));
  });
});
