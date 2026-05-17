import { describe, expect, it } from "vitest";

import { buildOverlayRuntimeNoopExecutionShellHarnessSectionVm } from "@/lib/overlay-ui/overlayRuntimeNoopExecutionShellHarnessAdapter";
import { RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeNoopExecutionShellHarness/runtimeNoopExecutionShellHarnessLabelsKo";
import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimeNoopExecutionShellHarnessSectionVm", () => {
  it("includes required disclaimer", () => {
    const vm = buildOverlayRuntimeNoopExecutionShellHarnessSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer).toBe(RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_SECTION_DISCLAIMER_KO);
    expect(vm.harnessReadinessKo.length).toBeGreaterThan(0);
    expect(vm.harnessModeKo.length).toBeGreaterThan(0);
    expect(vm.preflightReadinessKo.length).toBeGreaterThan(0);
  });

  it("compact mode hides detail sections", () => {
    const full = buildOverlayRuntimeNoopExecutionShellHarnessSectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimeNoopExecutionShellHarnessSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(full.showDetailSections).toBe(true);
    expect(compact.showDetailSections).toBe(false);
    expect(compact.contractBoundaryRows.length).toBeLessThanOrEqual(1);
    expect(compact.recommendationRows.length).toBeLessThanOrEqual(1);
  });

  it("compact mode displays harness readiness, mode, preflight, and top blocker or attention", () => {
    const vm = buildOverlayRuntimeNoopExecutionShellHarnessSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(vm.harnessReadinessKo).toBeTruthy();
    expect(vm.harnessModeKo).toBeTruthy();
    expect(vm.preflightReadinessKo).toBeTruthy();
    expect(vm.topViolationOrBlocker !== null || vm.showAttention).toBe(true);
  });
});
