import { describe, expect, it } from "vitest";

import { buildOverlayRuntimeFinalReleaseGovernanceGateSectionVm } from "@/lib/overlay-ui/overlayRuntimeFinalReleaseGovernanceGateAdapter";
import { RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeFinalReleaseGovernanceGate/runtimeFinalReleaseGovernanceGateLabelsKo";
import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimeFinalReleaseGovernanceGateSectionVm", () => {
  it("includes required disclaimer", () => {
    const vm = buildOverlayRuntimeFinalReleaseGovernanceGateSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer).toBe(RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_SECTION_DISCLAIMER_KO);
    expect(vm.candidateStatusKo.length).toBeGreaterThan(0);
    expect(vm.gateModeKo.length).toBeGreaterThan(0);
  });

  it("compact mode hides detail sections", () => {
    const full = buildOverlayRuntimeFinalReleaseGovernanceGateSectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimeFinalReleaseGovernanceGateSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(full.showDetailSections).toBe(true);
    expect(compact.showDetailSections).toBe(false);
    expect(compact.gateScopeSummaryRows.length).toBeLessThanOrEqual(1);
    expect(compact.readinessChecklistRows.length).toBeLessThanOrEqual(1);
  });

  it("compact mode displays candidate status, gate mode, final gate, and top blocker or attention", () => {
    const vm = buildOverlayRuntimeFinalReleaseGovernanceGateSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(vm.candidateStatusKo).toBeTruthy();
    expect(vm.gateModeKo).toBeTruthy();
    expect(vm.finalGateStatusKo).toBeTruthy();
    expect(vm.topViolationOrBlocker !== null || vm.showAttention).toBe(true);
  });
});
