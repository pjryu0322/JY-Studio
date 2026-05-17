import { describe, expect, it } from "vitest";

import { buildOverlayRuntimeExecutionBoundaryShellSectionVm } from "@/lib/overlay-ui/overlayRuntimeExecutionBoundaryShellAdapter";
import { RUNTIME_EXECUTION_BOUNDARY_SHELL_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeExecutionBoundaryShell/runtimeExecutionBoundaryShellLabelsKo";
import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimeExecutionBoundaryShellSectionVm", () => {
  it("includes required disclaimer", () => {
    const vm = buildOverlayRuntimeExecutionBoundaryShellSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer).toBe(RUNTIME_EXECUTION_BOUNDARY_SHELL_SECTION_DISCLAIMER_KO);
    expect(vm.candidateStatusKo.length).toBeGreaterThan(0);
    expect(vm.shellModeKo.length).toBeGreaterThan(0);
  });

  it("compact mode hides detail sections", () => {
    const full = buildOverlayRuntimeExecutionBoundaryShellSectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimeExecutionBoundaryShellSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(full.showDetailSections).toBe(true);
    expect(compact.showDetailSections).toBe(false);
    expect(compact.scopeSummaryRows.length).toBeLessThanOrEqual(1);
    expect(compact.readinessChecklistRows.length).toBeLessThanOrEqual(1);
  });

  it("compact mode displays candidate status, shell mode, and top blocker or attention", () => {
    const vm = buildOverlayRuntimeExecutionBoundaryShellSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(vm.candidateStatusKo).toBeTruthy();
    expect(vm.shellModeKo).toBeTruthy();
    expect(vm.topViolationOrBlocker !== null || vm.showAttention).toBe(true);
  });
});
