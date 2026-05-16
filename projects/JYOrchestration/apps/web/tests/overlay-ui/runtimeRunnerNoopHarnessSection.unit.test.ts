import { describe, expect, it } from "vitest";

import { buildOverlayRuntimeRunnerNoopHarnessSectionVm } from "@/lib/overlay-ui/overlayRuntimeRunnerNoopHarnessAdapter";
import { RUNTIME_RUNNER_NOOP_HARNESS_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeRunnerNoopHarness/runtimeRunnerNoopHarnessLabelsKo";
import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimeRunnerNoopHarnessSectionVm", () => {
  it("includes required disclaimer", () => {
    const vm = buildOverlayRuntimeRunnerNoopHarnessSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer).toBe(RUNTIME_RUNNER_NOOP_HARNESS_SECTION_DISCLAIMER_KO);
    expect(vm.harnessReadinessKo.length).toBeGreaterThan(0);
    expect(vm.harnessModeKo.length).toBeGreaterThan(0);
    expect(vm.preflightReadinessKo.length).toBeGreaterThan(0);
  });

  it("compact mode hides detail sections", () => {
    const full = buildOverlayRuntimeRunnerNoopHarnessSectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimeRunnerNoopHarnessSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(full.showDetailSections).toBe(true);
    expect(compact.showDetailSections).toBe(false);
    expect(compact.envelopeRows.length).toBeLessThanOrEqual(1);
    expect(compact.recommendationRows.length).toBeLessThanOrEqual(1);
  });

  it("compact mode displays harness readiness, mode, preflight, and final gate", () => {
    const vm = buildOverlayRuntimeRunnerNoopHarnessSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(vm.harnessReadinessKo).toBeTruthy();
    expect(vm.harnessModeKo).toBeTruthy();
    expect(vm.contractVerificationStatusKo).toBeTruthy();
    expect(vm.preflightReadinessKo).toBeTruthy();
    expect(vm.finalGateStatusKo).toBeTruthy();
    expect(vm.h31EntryReadinessKo).toBeTruthy();
    expect(vm.topViolationOrBlocker !== null || vm.showAttention).toBe(true);
  });
});
