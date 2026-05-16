import { describe, expect, it } from "vitest";

import { buildOverlayRuntimeRunnerInvocationSectionVm } from "@/lib/overlay-ui/overlayRuntimeRunnerInvocationAdapter";
import { RUNTIME_RUNNER_INVOCATION_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeRunnerInvocation/runtimeRunnerInvocationLabelsKo";
import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimeRunnerInvocationSectionVm", () => {
  it("includes required disclaimer and footer-related fields", () => {
    const vm = buildOverlayRuntimeRunnerInvocationSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer).toBe(RUNTIME_RUNNER_INVOCATION_SECTION_DISCLAIMER_KO);
    expect(vm.candidateStatusKo.length).toBeGreaterThan(0);
    expect(vm.invocationModeKo.length).toBeGreaterThan(0);
    expect(vm.invocationPolicySummaryKo.length).toBeGreaterThan(0);
  });

  it("compact mode hides detail sections and limits rows", () => {
    const full = buildOverlayRuntimeRunnerInvocationSectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimeRunnerInvocationSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(full.showDetailSections).toBe(true);
    expect(compact.showDetailSections).toBe(false);
    expect(compact.forbiddenInvocationOperationRows.length).toBeLessThanOrEqual(1);
    expect(compact.readinessChecklistRows.length).toBeLessThanOrEqual(1);
  });

  it("compact mode displays candidate status, invocation mode, and final gate", () => {
    const vm = buildOverlayRuntimeRunnerInvocationSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(vm.candidateStatusKo).toBeTruthy();
    expect(vm.invocationModeKo).toBeTruthy();
    expect(vm.finalGateStatusKo).toBeTruthy();
    expect(
      vm.topViolationOrBlocker !== null ||
        vm.topInvocationBlocker !== null ||
        vm.topForbiddenInvocationOperation !== null ||
        vm.showAttention
    ).toBe(true);
  });
});
