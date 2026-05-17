import { describe, expect, it } from "vitest";

import { buildOverlayRuntimeNoopShellReleaseGateSectionVm } from "@/lib/overlay-ui/overlayRuntimeNoopShellReleaseGateAdapter";
import { RUNTIME_NOOP_SHELL_RELEASE_GATE_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeNoopShellReleaseGate/runtimeNoopShellReleaseGateLabelsKo";
import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimeNoopShellReleaseGateSectionVm", () => {
  it("includes required disclaimer", () => {
    const vm = buildOverlayRuntimeNoopShellReleaseGateSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer).toBe(RUNTIME_NOOP_SHELL_RELEASE_GATE_SECTION_DISCLAIMER_KO);
    expect(vm.candidateStatusKo.length).toBeGreaterThan(0);
    expect(vm.releaseGateModeKo.length).toBeGreaterThan(0);
  });

  it("compact mode hides detail sections", () => {
    const full = buildOverlayRuntimeNoopShellReleaseGateSectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimeNoopShellReleaseGateSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(full.showDetailSections).toBe(true);
    expect(compact.showDetailSections).toBe(false);
    expect(compact.scopeSummaryRows.length).toBeLessThanOrEqual(1);
    expect(compact.readinessChecklistRows.length).toBeLessThanOrEqual(1);
  });

  it("compact mode displays candidate status, mode, and top blocker or attention", () => {
    const vm = buildOverlayRuntimeNoopShellReleaseGateSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(vm.candidateStatusKo).toBeTruthy();
    expect(vm.releaseGateModeKo).toBeTruthy();
    expect(vm.topViolationOrBlocker !== null || vm.showAttention).toBe(true);
  });
});
