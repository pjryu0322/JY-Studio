import { describe, expect, it } from "vitest";

import { buildOverlayRuntimeExecutionGovernanceBoundarySectionVm } from "@/lib/overlay-ui/overlayRuntimeExecutionGovernanceBoundaryAdapter";
import { RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeExecutionGovernanceBoundary/runtimeExecutionGovernanceBoundaryLabelsKo";
import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimeExecutionGovernanceBoundarySectionVm", () => {
  it("includes required disclaimer", () => {
    const vm = buildOverlayRuntimeExecutionGovernanceBoundarySectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer).toBe(RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_SECTION_DISCLAIMER_KO);
    expect(vm.candidateStatusKo.length).toBeGreaterThan(0);
    expect(vm.governanceModeKo.length).toBeGreaterThan(0);
    expect(vm.hardeningReadinessKo.length).toBeGreaterThan(0);
    expect(vm.finalGateStatusKo.length).toBeGreaterThan(0);
    expect(vm.h38EntryReadinessKo.length).toBeGreaterThan(0);
  });

  it("compact mode hides detail sections", () => {
    const full = buildOverlayRuntimeExecutionGovernanceBoundarySectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimeExecutionGovernanceBoundarySectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(full.showDetailSections).toBe(true);
    expect(compact.showDetailSections).toBe(false);
    expect(compact.scopeSummaryRows.length).toBeLessThanOrEqual(1);
    expect(compact.readinessChecklistRows.length).toBeLessThanOrEqual(1);
  });

  it("compact mode displays candidate status, governance mode, hardening readiness, final gate, and top blocker or attention", () => {
    const vm = buildOverlayRuntimeExecutionGovernanceBoundarySectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(vm.candidateStatusKo).toBeTruthy();
    expect(vm.governanceModeKo).toBeTruthy();
    expect(vm.hardeningReadinessKo).toBeTruthy();
    expect(vm.finalGateStatusKo).toBeTruthy();
    expect(vm.topViolationOrBlocker !== null || vm.showAttention).toBe(true);
  });
});
