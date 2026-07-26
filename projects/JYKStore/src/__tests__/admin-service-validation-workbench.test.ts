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
      }),
      false,
    );
    assert.equal(isOpenProviderSupplementPhase("PENDING"), true);
    assert.equal(isOpenProviderSupplementPhase("RESOLVED"), true);
    assert.equal(isOpenProviderSupplementPhase("REJECTED"), false);
    assert.equal(isOpenProviderSupplementPhase("WITHDRAWN"), false);
  });

  it("request-provider-review route rejects open supplement with PROVIDER_SUPPLEMENT_OPEN", () => {
    const route = readSource(
      "src/app/api/v1/admin/packs/[packId]/store-workflow/request-provider-review/route.ts",
    );
    assert.ok(route.includes("PROVIDER_SUPPLEMENT_OPEN"));
    assert.ok(route.includes("isOpenProviderSupplementPhase"));
    assert.ok(route.includes("resolveStoreWorkflowMarkers"));
    assert.ok(route.includes("providerSupplementPhase"));
  });
});

describe("admin service validation view model (step4)", () => {
  it("blocks when provider is not confirmed", () => {
    const vm = buildAdminServiceValidationViewModel({
      providerConfirmed: false,
      openSupplement: false,
      serviceDone: false,
      channelGates: null,
    });
    assert.equal(vm.canMarkPassed, false);
    assert.ok(vm.blockedReasons.some((r) => r.includes("제공자 확인")));
  });

  it("blocks when supplement is open", () => {
    const vm = buildAdminServiceValidationViewModel({
      providerConfirmed: true,
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
      providerConfirmed: true,
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
      providerConfirmed: true,
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

  it("enables mark-passed when ready", () => {
    const vm = buildAdminServiceValidationViewModel({
      providerConfirmed: true,
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
      providerConfirmed: true,
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
    assert.match(vm.primaryLabel, /완료됨/);
  });

  it("isolates service validation into AdminServiceValidationWorkbenchPanel", () => {
    const detail = readSource("src/components/AdminReviewDetailPageClient.tsx");
    assert.ok(detail.includes("AdminServiceValidationWorkbenchPanel"));
    assert.ok(!detail.includes("AdminServiceValidationOpsPanel"));
    assert.ok(detail.includes("onMarkPassed"));
    const panel = readSource("src/components/AdminServiceValidationWorkbenchPanel.tsx");
    assert.ok(panel.includes("채널별 검증 현황"));
    assert.ok(panel.includes("AdminServiceValidationOpsPanel"));
  });
});

describe("admin review rail service validation (step4)", () => {
  it("CONFIRMED + NONE service → searchValidation current/next", () => {
    const rail = getAdminReviewRailState({
      packId: "p1",
      workerZipPhase: "COMPLETED",
      quality: qualityOk,
      providerReviewPhase: "CONFIRMED",
      serviceValidationPhase: "NONE",
      providerSupplementPhase: "NONE",
      detail: null,
      activeStep: "searchValidation",
    });
    assert.equal(rail.currentStep, "searchValidation");
    const search = rail.items.find((i) => i.id === "searchValidation");
    assert.equal(search?.status, "current");
  });

  it("CONFIRMED + open supplement → searchValidation blocked", () => {
    const rail = getAdminReviewRailState({
      packId: "p1",
      workerZipPhase: "COMPLETED",
      quality: qualityOk,
      providerReviewPhase: "CONFIRMED",
      serviceValidationPhase: "NONE",
      providerSupplementPhase: "PENDING",
      detail: null,
      activeStep: "providerConfirm",
    });
    assert.equal(rail.currentStep, "providerConfirm");
    const search = rail.items.find((i) => i.id === "searchValidation");
    assert.equal(search?.status, "blocked");
    const decision = rail.items.find((i) => i.id === "decision");
    assert.equal(decision?.status, "blocked");
  });

  it("CONFIRMED + PASSED → decision stage", () => {
    const rail = getAdminReviewRailState({
      packId: "p1",
      workerZipPhase: "COMPLETED",
      quality: qualityOk,
      providerReviewPhase: "CONFIRMED",
      serviceValidationPhase: "PASSED",
      providerSupplementPhase: "NONE",
      detail: null,
      activeStep: "decision",
    });
    assert.equal(rail.currentStep, "decision");
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
      activeStep: "providerConfirm",
    });
    const search = rail.items.find((i) => i.id === "searchValidation");
    assert.equal(search?.status, "blocked");
  });
});
