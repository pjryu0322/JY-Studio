import { describe, expect, it } from "vitest";

import { buildOverlayRuntimeNoopExecutionShellSectionVm } from "@/lib/overlay-ui/overlayRuntimeNoopExecutionShellAdapter";
import { RUNTIME_NOOP_EXECUTION_SHELL_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeNoopExecutionShell/runtimeNoopExecutionShellLabelsKo";
import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimeNoopExecutionShellSectionVm", () => {
  it("includes required disclaimer", () => {
    const vm = buildOverlayRuntimeNoopExecutionShellSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer).toBe(RUNTIME_NOOP_EXECUTION_SHELL_SECTION_DISCLAIMER_KO);
    expect(vm.candidateStatusKo.length).toBeGreaterThan(0);
    expect(vm.shellModeKo.length).toBeGreaterThan(0);
  });

  it("compact mode hides detail sections", () => {
    const full = buildOverlayRuntimeNoopExecutionShellSectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimeNoopExecutionShellSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(full.showDetailSections).toBe(true);
    expect(compact.showDetailSections).toBe(false);
    expect(compact.scopeSummaryRows.length).toBeLessThanOrEqual(1);
    expect(compact.recommendationRows.length).toBeLessThanOrEqual(1);
  });

  it("compact mode displays candidate status, shell mode, and top blocker or attention", () => {
    const vm = buildOverlayRuntimeNoopExecutionShellSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(vm.candidateStatusKo).toBeTruthy();
    expect(vm.shellModeKo).toBeTruthy();
    expect(vm.topViolationOrBlocker !== null || vm.showAttention).toBe(true);
  });
});
