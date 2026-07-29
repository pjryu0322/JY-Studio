import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { canRequestProviderReviewHandoff } from "../lib/store-workflow-handoff-gates-policy.ts";
import { isOpenProviderSupplementPhase } from "../lib/provider-supplement-request.ts";
import { buildAdminServiceValidationViewModel } from "../lib/role-workspace/admin-service-validation-view-model.ts";
import {
  buildAdminQualityGateSnapshot,
  getAdminReviewRailState,
} from "../lib/role-workspace/admin-review-rail.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
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

describe("admin provider review P0 (open supplement)", () => {
  it("hides plain request form when WITHDRAWN + open supplement", () => {
    const panel = readSource("src/components/AdminProviderReviewPanel.tsx");
    assert.ok(panel.includes("!hasOpenSupplement"));
    assert.ok(panel.includes("isOpenProviderSupplementPhase"));
    assert.ok(panel.includes("showRequestForm"));
  });

  it("blocks canRequestProviderReviewHandoff while supplement is open", () => {
    assert.equal(
      canRequestProviderReviewHandoff({
        workerZipPhase: "COMPLETED",
        quality: qualityOk,
        providerReviewPhase: "WITHDRAWN",
        providerSupplementPhase: "PENDING",
        serviceValidationPhase: "PASSED",
      }),
      false,
    );
    assert.equal(isOpenProviderSupplementPhase("PENDING"), true);
    assert.equal(isOpenProviderSupplementPhase("RESOLVED"), true);
    assert.equal(isOpenProviderSupplementPhase("REJECTED"), false);
    assert.equal(isOpenProviderSupplementPhase("WITHDRAWN"), false);
  });

  it("requires service validation PASSED before provider review handoff", () => {
    assert.equal(
      canRequestProviderReviewHandoff({
        workerZipPhase: "COMPLETED",
        quality: qualityOk,
        providerReviewPhase: "NONE",
        providerSupplementPhase: "NONE",
        serviceValidationPhase: "NONE",
      }),
      false,
    );
    assert.equal(
      canRequestProviderReviewHandoff({
        workerZipPhase: "COMPLETED",
        quality: qualityOk,
        providerReviewPhase: "NONE",
        providerSupplementPhase: "NONE",
        serviceValidationPhase: "PASSED",
      }),
      true,
    );
  });

  it("request-provider-review route rejects open supplement with PROVIDER_SUPPLEMENT_OPEN", () => {
    const route = readSource(
      "src/app/api/v1/admin/packs/[packId]/store-workflow/request-provider-review/route.ts",
    );
    assert.ok(route.includes("PROVIDER_SUPPLEMENT_OPEN"));
    assert.ok(route.includes("isOpenProviderSupplementPhase"));
    assert.ok(route.includes("resolveStoreWorkflowMarkers"));
    assert.ok(route.includes("providerSupplementPhase"));
    assert.ok(route.includes("SERVICE_VALIDATION_REQUIRED"));
  });

  it("markAdminServiceValidationPassed rejects open supplement with PROVIDER_SUPPLEMENT_OPEN", () => {
    const markers = readSource("src/lib/store-workflow-markers.ts");
    assert.ok(markers.includes("PROVIDER_SUPPLEMENT_OPEN"));
    assert.ok(markers.includes("isOpenProviderSupplementPhase"));
    assert.ok(
      markers.includes("제공자 보완요청이 처리되지 않아 서비스 검증을 완료할 수 없습니다."),
    );
    assert.ok(!markers.includes("PROVIDER_CONFIRM_REQUIRED"));
    const route = readSource(
      "src/app/api/v1/admin/packs/[packId]/store-workflow/service-validation/route.ts",
    );
    assert.ok(route.includes("providerSupplementPhase"));
  });
});

describe("admin service validation view model (P2)", () => {
  it("does not block on missing provider confirmation", () => {
    const vm = buildAdminServiceValidationViewModel({
      providerConfirmed: false,
      openSupplement: false,
      serviceDone: false,
      channelGates: null,
    });
    assert.equal(vm.canMarkPassed, false);
    assert.ok(!vm.blockedReasons.some((r) => r.includes("제공자 확인")));
    assert.ok(vm.blockedReasons.some((r) => r.includes("확인하는 중")));
  });

  it("blocks when supplement is open", () => {
    const vm = buildAdminServiceValidationViewModel({
      providerConfirmed: false,
      openSupplement: true,
      serviceDone: false,
      channelGates: {
        allPassed: true,
        bindingStatus: "CURRENT",
        bindingReason: null,
        channels: [],
        missingLabels: [],
      },
    });
    assert.equal(vm.canMarkPassed, false);
    assert.ok(vm.blockedReasons.some((r) => r.includes("보완요청")));
  });

  it("flags non-CURRENT binding", () => {
    const vm = buildAdminServiceValidationViewModel({
      openSupplement: false,
      serviceDone: false,
      channelGates: {
        allPassed: false,
        bindingStatus: "STALE",
        bindingReason: "재생성이 반영되지 않았습니다.",
        channels: [
          { channel: "API", label: "API", passed: false, reason: "STALE", reasonCode: "STALE_BINDING" },
        ],
        missingLabels: ["API"],
      },
    });
    assert.equal(vm.canMarkPassed, false);
    assert.ok(vm.blockedReasons.some((r) => r.includes("재생성") || r.includes("최신")));
  });

  it("lists missing channels when not allPassed", () => {
    const vm = buildAdminServiceValidationViewModel({
      openSupplement: false,
      serviceDone: false,
      channelGates: {
        allPassed: false,
        bindingStatus: "CURRENT",
        bindingReason: null,
        channels: [
          { channel: "API", label: "API", passed: true, reason: null },
          { channel: "MCP", label: "MCP", passed: false, reason: "미실행" },
        ],
        missingLabels: ["MCP"],
      },
    });
    assert.equal(vm.missingChannels.length, 1);
    assert.equal(vm.missingChannels[0]?.channel, "MCP");
    assert.equal(vm.canMarkPassed, false);
  });

  it("enables mark-passed when channels ready without provider confirm", () => {
    const vm = buildAdminServiceValidationViewModel({
      providerConfirmed: false,
      openSupplement: false,
      serviceDone: false,
      channelGates: {
        allPassed: true,
        bindingStatus: "CURRENT",
        bindingReason: null,
        channels: [
          { channel: "API", label: "API", passed: true, reason: null },
          { channel: "MCP", label: "MCP", passed: true, reason: null },
          { channel: "DOWNLOAD", label: "ZIP/RAG Export", passed: true, reason: null },
        ],
        missingLabels: [],
      },
    });
    assert.equal(vm.status, "READY");
    assert.equal(vm.canMarkPassed, true);
  });

  it("shows done state when serviceDone", () => {
    const vm = buildAdminServiceValidationViewModel({
      openSupplement: false,
      serviceDone: true,
      channelGates: {
        allPassed: true,
        bindingStatus: "CURRENT",
        bindingReason: null,
        channels: [],
        missingLabels: [],
      },
    });
    assert.equal(vm.status, "DONE");
    assert.equal(vm.canMarkPassed, false);
    assert.match(vm.primaryLabel, /게시/);
  });

  it("isolates service validation into AdminServiceValidationWorkbenchPanel", () => {
    const detail = readSource("src/components/AdminReviewDetailPageClient.tsx");
    assert.ok(detail.includes("AdminServiceValidationWorkbenchPanel"));
    assert.ok(!detail.includes("AdminServiceValidationOpsPanel"));
    assert.ok(detail.includes("onMarkPassed"));
    assert.ok(detail.includes("onRefreshChannels"));
    const panel = readSource("src/components/AdminServiceValidationWorkbenchPanel.tsx");
    assert.ok(panel.includes("서비스 가능"));
    assert.ok(panel.includes("주의"));
    assert.ok(panel.includes("게시 불가"));
    assert.ok(panel.includes("상세 보기"));
    assert.ok(panel.includes("AdminServiceValidationOpsPanel"));
    assert.ok(panel.includes("resolveAdminServiceValidationUxStatus"));
    const vm = readSource("src/lib/role-workspace/admin-service-validation-view-model.ts");
    assert.ok(vm.includes("resolveAdminServiceValidationUxStatus"));
  });
});

describe("admin review rail service validation (P2 order)", () => {
  it("COMPLETED + quality ok + NONE service → serviceValidation", () => {
    const rail = getAdminReviewRailState({
      packId: "p1",
      workerZipPhase: "COMPLETED",
      quality: qualityOk,
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
      providerSupplementPhase: "NONE",
      detail: null,
      activeStep: "serviceValidation",
    });
    assert.equal(rail.currentStep, "serviceValidation");
    const search = rail.items.find((i) => i.id === "serviceValidation");
    assert.equal(search?.status, "current");
  });

  it("open supplement → serviceValidation blocked", () => {
    const rail = getAdminReviewRailState({
      packId: "p1",
      workerZipPhase: "COMPLETED",
      quality: qualityOk,
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
      providerSupplementPhase: "PENDING",
      detail: null,
      activeStep: "correction",
    });
    assert.equal(rail.currentStep, "correction");
    const search = rail.items.find((i) => i.id === "serviceValidation");
    assert.equal(search?.status, "blocked");
    const publish = rail.items.find((i) => i.id === "publish");
    assert.equal(publish?.status, "blocked");
  });

  it("PASSED service + CONFIRMED provider → publish stage", () => {
    const rail = getAdminReviewRailState({
      packId: "p1",
      workerZipPhase: "COMPLETED",
      quality: qualityOk,
      providerReviewPhase: "CONFIRMED",
      serviceValidationPhase: "PASSED",
      providerSupplementPhase: "NONE",
      detail: null,
      activeStep: "publish",
    });
    assert.equal(rail.currentStep, "publish");
    const publish = rail.items.find((i) => i.id === "publish");
    assert.equal(publish?.label, "게시");
    assert.ok(!rail.items.some((i) => i.id === "decision"));
    assert.ok(!rail.items.some((i) => i.id === "providerConfirm"));
  });

  it("RESOLVED supplement still blocks service validation", () => {
    assert.equal(isOpenProviderSupplementPhase("RESOLVED"), true);
    const rail = getAdminReviewRailState({
      packId: "p1",
      workerZipPhase: "COMPLETED",
      quality: qualityOk,
      providerReviewPhase: "WITHDRAWN",
      serviceValidationPhase: "NONE",
      providerSupplementPhase: "RESOLVED",
      detail: null,
      activeStep: "correction",
    });
    const search = rail.items.find((i) => i.id === "serviceValidation");
    assert.equal(search?.status, "blocked");
  });
});
