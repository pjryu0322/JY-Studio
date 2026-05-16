import { describe, expect, it } from "vitest";

import { buildOverlayRuntimePilotActivationSectionVm } from "@/lib/overlay-ui/overlayRuntimePilotActivationAdapter";
import { RUNTIME_PILOT_ACTIVATION_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimePilotActivation/runtimePilotActivationLabelsKo";
import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimePilotActivationSectionVm", () => {
  it("includes required disclaimer and footer-related fields", () => {
    const vm = buildOverlayRuntimePilotActivationSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer).toBe(RUNTIME_PILOT_ACTIVATION_SECTION_DISCLAIMER_KO);
    expect(vm.candidateStatusKo.length).toBeGreaterThan(0);
    expect(vm.activationModeKo.length).toBeGreaterThan(0);
  });

  it("compact mode hides detail sections and limits rows", () => {
    const full = buildOverlayRuntimePilotActivationSectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimePilotActivationSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(full.showDetailSections).toBe(true);
    expect(compact.showDetailSections).toBe(false);
    expect(compact.readinessChecklistRows.length).toBeLessThanOrEqual(1);
    expect(compact.forbiddenActivationOperationRows.length).toBeLessThanOrEqual(1);
  });

  it("compact mode keeps status, mode, and top blocker or forbidden operation", () => {
    const vm = buildOverlayRuntimePilotActivationSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(vm.candidateStatusKo).toBeTruthy();
    expect(vm.activationModeKo).toBeTruthy();
    expect(
      vm.topActivationBlocker !== null || vm.topForbiddenActivationOperation !== null || vm.showAttention
    ).toBe(true);
  });
});
