import { describe, expect, it } from "vitest";

import { buildOverlayRuntimeResourceTrialSectionVm } from "@/lib/overlay-ui/overlayRuntimeResourceTrialAdapter";

import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimeResourceTrialSectionVm", () => {
  it("includes disclaimer and trial labels", () => {
    const vm = buildOverlayRuntimeResourceTrialSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer.length).toBeGreaterThan(0);
    expect(vm.trialModeKo.length).toBeGreaterThan(0);
    expect(vm.consistencyKo.length).toBeGreaterThan(0);
  });

  it("collapses forecast/governance/drift detail in compact narrow mode", () => {
    const full = buildOverlayRuntimeResourceTrialSectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimeResourceTrialSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(compact.showDetailSections).toBe(false);
    if (full.forecastObservations.length > 1) {
      expect(compact.forecastObservations.length).toBeLessThanOrEqual(1);
    }
    if (full.governanceObservations.length > 1) {
      expect(compact.governanceObservations.length).toBeLessThanOrEqual(1);
    }
    if (full.driftFindings.length > 1) {
      expect(compact.driftFindings.length).toBeLessThanOrEqual(1);
    }
  });
});
