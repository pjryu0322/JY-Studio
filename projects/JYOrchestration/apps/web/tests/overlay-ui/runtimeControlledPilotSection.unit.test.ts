import { describe, expect, it } from "vitest";

import { buildOverlayRuntimeControlledPilotSectionVm } from "@/lib/overlay-ui/overlayRuntimeControlledPilotAdapter";

import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimeControlledPilotSectionVm", () => {
  it("includes disclaimer and readiness labels", () => {
    const vm = buildOverlayRuntimeControlledPilotSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer.length).toBeGreaterThan(0);
    expect(vm.pilotReadinessKo.length).toBeGreaterThan(0);
    expect(vm.pilotScopeKo.length).toBeGreaterThan(0);
    expect(vm.candidateFlowKo.length).toBeGreaterThan(0);
  });

  it("hides detail lists in compact narrow mode", () => {
    const full = buildOverlayRuntimeControlledPilotSectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimeControlledPilotSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(compact.showDetailSections).toBe(false);
    expect(full.showDetailSections).toBe(true);
  });
});
