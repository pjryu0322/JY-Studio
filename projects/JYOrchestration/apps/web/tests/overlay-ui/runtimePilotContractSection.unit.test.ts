import { describe, expect, it } from "vitest";

import { buildOverlayRuntimePilotContractSectionVm } from "@/lib/overlay-ui/overlayRuntimePilotContractAdapter";

import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimePilotContractSectionVm", () => {
  it("includes disclaimer and contract labels", () => {
    const vm = buildOverlayRuntimePilotContractSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer.length).toBeGreaterThan(0);
    expect(vm.contractReadinessKo.length).toBeGreaterThan(0);
    expect(vm.adapterBoundaryModeKo.length).toBeGreaterThan(0);
    expect(vm.handoffReadinessKo.length).toBeGreaterThan(0);
  });

  it("hides detail lists in compact narrow mode", () => {
    const full = buildOverlayRuntimePilotContractSectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimePilotContractSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(compact.showDetailSections).toBe(false);
    expect(full.showDetailSections).toBe(true);
  });
});
