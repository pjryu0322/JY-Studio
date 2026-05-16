import { describe, expect, it } from "vitest";

import { buildOverlayRuntimePilotSkeletonSectionVm } from "@/lib/overlay-ui/overlayRuntimePilotSkeletonAdapter";
import { RUNTIME_PILOT_SKELETON_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimePilotSkeleton/runtimePilotSkeletonLabelsKo";
import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimePilotSkeletonSectionVm", () => {
  it("includes required disclaimer and footer-related fields", () => {
    const vm = buildOverlayRuntimePilotSkeletonSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer).toBe(RUNTIME_PILOT_SKELETON_SECTION_DISCLAIMER_KO);
    expect(vm.skeletonReadinessKo.length).toBeGreaterThan(0);
    expect(vm.runnerModeKo.length).toBeGreaterThan(0);
    expect(vm.contractRunnerName.length).toBeGreaterThan(0);
  });

  it("compact mode hides detail sections and limits rows", () => {
    const full = buildOverlayRuntimePilotSkeletonSectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimePilotSkeletonSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(full.showDetailSections).toBe(true);
    expect(compact.showDetailSections).toBe(false);
    expect(compact.forbiddenRunnerOperationRows.length).toBeLessThanOrEqual(1);
    expect(compact.safetyGuardRows.length).toBeLessThanOrEqual(1);
  });

  it("compact mode displays skeleton readiness and runner mode", () => {
    const vm = buildOverlayRuntimePilotSkeletonSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(vm.skeletonReadinessKo).toBeTruthy();
    expect(vm.runnerModeKo).toBeTruthy();
    expect(
      vm.topSkeletonBlocker !== null || vm.topForbiddenRunnerOperation !== null || vm.showAttention
    ).toBe(true);
  });
});
