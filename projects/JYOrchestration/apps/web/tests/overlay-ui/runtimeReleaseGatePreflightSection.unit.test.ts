import { describe, expect, it } from "vitest";

import { buildOverlayRuntimeReleaseGatePreflightSectionVm } from "@/lib/overlay-ui/overlayRuntimeReleaseGatePreflightAdapter";
import { RUNTIME_RELEASE_GATE_PREFLIGHT_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightLabelsKo";
import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimeReleaseGatePreflightSectionVm", () => {
  it("includes required disclaimer", () => {
    const vm = buildOverlayRuntimeReleaseGatePreflightSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer).toBe(RUNTIME_RELEASE_GATE_PREFLIGHT_SECTION_DISCLAIMER_KO);
    expect(vm.preflightReadinessKo.length).toBeGreaterThan(0);
    expect(vm.preflightModeKo.length).toBeGreaterThan(0);
  });

  it("compact mode hides detail sections", () => {
    const full = buildOverlayRuntimeReleaseGatePreflightSectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimeReleaseGatePreflightSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(full.showDetailSections).toBe(true);
    expect(compact.showDetailSections).toBe(false);
    expect(compact.inputEnvelopeRows.length).toBeLessThanOrEqual(1);
    expect(compact.preflightChecklistRows.length).toBeLessThanOrEqual(1);
  });

  it("compact mode displays preflight readiness, mode, final gate, and top blocker or attention", () => {
    const vm = buildOverlayRuntimeReleaseGatePreflightSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(vm.preflightReadinessKo).toBeTruthy();
    expect(vm.preflightModeKo).toBeTruthy();
    expect(vm.finalGateStatusKo).toBeTruthy();
    expect(vm.topViolationOrBlocker !== null || vm.showAttention).toBe(true);
  });
});
