import { describe, expect, it } from "vitest";

import { buildOverlayRuntimeResourceAllocationSectionVm } from "@/lib/overlay-ui/overlayRuntimeResourceAllocationAdapter";

import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimeResourceAllocationSectionVm", () => {
  it("includes disclaimer and planning rows", () => {
    const vm = buildOverlayRuntimeResourceAllocationSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer.length).toBeGreaterThan(0);
    expect(vm.globalAllocationModeKo.length).toBeGreaterThan(0);
    expect(vm.memberRows.length).toBeGreaterThan(0);
  });

  it("collapses member and recommendation rows in compact narrow mode", () => {
    const vm = buildOverlayRuntimeResourceAllocationSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(vm.showDetailSections).toBe(false);
    expect(vm.memberRows.length).toBeLessThanOrEqual(2);
    expect(vm.recommendationRows.length).toBeLessThanOrEqual(1);
  });
});
