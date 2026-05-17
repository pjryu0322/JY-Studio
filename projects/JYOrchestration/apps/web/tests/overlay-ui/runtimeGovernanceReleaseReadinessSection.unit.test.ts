import { describe, expect, it } from "vitest";

import { buildOverlayRuntimeGovernanceReleaseReadinessSectionVm } from "@/lib/overlay-ui/overlayRuntimeGovernanceReleaseReadinessAdapter";
import { RUNTIME_GOVERNANCE_RELEASE_READINESS_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeGovernanceReleaseReadiness/runtimeGovernanceReleaseReadinessLabelsKo";
import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimeGovernanceReleaseReadinessSectionVm", () => {
  it("includes required disclaimer", () => {
    const vm = buildOverlayRuntimeGovernanceReleaseReadinessSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer).toBe(RUNTIME_GOVERNANCE_RELEASE_READINESS_SECTION_DISCLAIMER_KO);
    expect(vm.readinessStatusKo.length).toBeGreaterThan(0);
    expect(vm.readinessModeKo.length).toBeGreaterThan(0);
  });

  it("compact mode hides detail sections", () => {
    const full = buildOverlayRuntimeGovernanceReleaseReadinessSectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimeGovernanceReleaseReadinessSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(full.showDetailSections).toBe(true);
    expect(compact.showDetailSections).toBe(false);
    expect(compact.inputEnvelopeRows.length).toBeLessThanOrEqual(1);
    expect(compact.readinessChecklistRows.length).toBeLessThanOrEqual(1);
  });

  it("compact mode displays readiness status, mode, and top blocker or attention", () => {
    const vm = buildOverlayRuntimeGovernanceReleaseReadinessSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(vm.readinessStatusKo).toBeTruthy();
    expect(vm.readinessModeKo).toBeTruthy();
    expect(vm.topViolationOrBlocker !== null || vm.showAttention).toBe(true);
  });
});
