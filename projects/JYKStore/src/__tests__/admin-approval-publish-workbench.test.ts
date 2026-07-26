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

function minimalDetail(
  status: string,
): AdminReviewDetailDto {
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

describe("admin approval publish workbench (step5)", () => {
  it("blocks when provider is not confirmed", () => {
    const vm = buildAdminApprovalPublishViewModel({
      detail: minimalDetail("REVIEWING"),
      providerConfirmed: false,
      serviceDone: true,
      openSupplement: false,
      quality: qualityOk,
      workerZipPhase: "COMPLETED",
    });
    assert.equal(vm.status, "BLOCKED");
    assert.equal(vm.canDecide, false);
    assert.ok(vm.blockedReasons.some((r) => r.includes("제공자 확인")));
  });

  it("blocks when service validation is incomplete", () => {
    const vm = buildAdminApprovalPublishViewModel({
      detail: minimalDetail("REVIEWING"),
      providerConfirmed: true,
      serviceDone: false,
      openSupplement: false,
      quality: qualityOk,
      workerZipPhase: "COMPLETED",
    });
    assert.equal(vm.status, "BLOCKED");
    assert.ok(vm.blockedReasons.some((r) => r.includes("서비스 검증")));
  });

  it("blocks when quality has blockers", () => {
    const vm = buildAdminApprovalPublishViewModel({
      detail: minimalDetail("REVIEWING"),
      providerConfirmed: true,
      serviceDone: true,
      openSupplement: false,
      quality: {
        ...qualityOk,
        hasBlockers: true,
        failCount: 1,
        blockers: ["FAIL"],
      },
      workerZipPhase: "COMPLETED",
    });
    assert.equal(vm.status, "BLOCKED");
    assert.ok(vm.blockedReasons.some((r) => r.includes("품질")));
  });

  it("blocks when open supplement exists", () => {
    const vm = buildAdminApprovalPublishViewModel({
      detail: minimalDetail("REVIEWING"),
      providerConfirmed: true,
      serviceDone: true,
      openSupplement: true,
      quality: qualityOk,
      workerZipPhase: "COMPLETED",
    });
    assert.equal(vm.status, "BLOCKED");
    assert.ok(vm.blockedReasons.some((r) => r.includes("보완요청")));
  });

  it("is READY_TO_DECIDE when gates pass", () => {
    const vm = buildAdminApprovalPublishViewModel({
      detail: minimalDetail("REVIEWING"),
      providerConfirmed: true,
      serviceDone: true,
      openSupplement: false,
      quality: qualityOk,
      workerZipPhase: "COMPLETED",
    });
    assert.equal(vm.status, "READY_TO_DECIDE");
    assert.equal(vm.canDecide, true);
  });

  it("marks PUBLISHED packs", () => {
    const vm = buildAdminApprovalPublishViewModel({
      detail: minimalDetail("PUBLISHED"),
      providerConfirmed: true,
      serviceDone: true,
      openSupplement: false,
      quality: qualityOk,
      workerZipPhase: "COMPLETED",
    });
    assert.equal(vm.status, "PUBLISHED");
    assert.equal(vm.canDecide, false);
  });

  it("isolates approval into AdminApprovalPublishWorkbenchPanel", () => {
    const detail = readSource("src/components/AdminReviewDetailPageClient.tsx");
    assert.ok(detail.includes("AdminApprovalPublishWorkbenchPanel"));
    assert.ok(!detail.includes("AdminReviewAcceptTab"));
    assert.ok(!detail.includes("AdminReviewReceiptInfoCard"));
    const panel = readSource("src/components/AdminApprovalPublishWorkbenchPanel.tsx");
    assert.ok(panel.includes("AdminReviewAcceptTab"));
    assert.ok(panel.includes("최종 점검 체크리스트"));
  });

  it("approvePackReview gates open supplement and store workflow", () => {
    const service = readSource("src/lib/admin-review-service.ts");
    assert.ok(service.includes("PROVIDER_SUPPLEMENT_OPEN"));
    assert.ok(service.includes("isOpenProviderSupplementPhase"));
    assert.ok(service.includes("SERVICE_VALIDATION_REQUIRED"));
    assert.ok(service.includes("resolveStoreWorkflowMarkers"));
  });
});
