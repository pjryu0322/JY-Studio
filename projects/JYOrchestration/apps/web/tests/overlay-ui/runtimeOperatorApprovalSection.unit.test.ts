import { describe, expect, it } from "vitest";

import { buildOverlayRuntimeOperatorApprovalSectionVm } from "@/lib/overlay-ui/overlayRuntimeOperatorApprovalAdapter";

import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimeOperatorApprovalSectionVm", () => {
  it("includes disclaimer and readiness labels", () => {
    const vm = buildOverlayRuntimeOperatorApprovalSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer.length).toBeGreaterThan(0);
    expect(vm.approvalReadinessKo.length).toBeGreaterThan(0);
    expect(vm.rollbackReadinessKo.length).toBeGreaterThan(0);
    expect(vm.auditReadinessKo.length).toBeGreaterThan(0);
    expect(vm.pilotPreconditionReadinessKo.length).toBeGreaterThan(0);
  });

  it("hides detail lists in compact narrow mode", () => {
    const full = buildOverlayRuntimeOperatorApprovalSectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimeOperatorApprovalSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(compact.showDetailSections).toBe(false);
    expect(full.showDetailSections).toBe(true);
  });
});
