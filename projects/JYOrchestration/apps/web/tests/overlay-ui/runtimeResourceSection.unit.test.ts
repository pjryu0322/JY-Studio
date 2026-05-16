import { describe, expect, it } from "vitest";

import { RUNTIME_RESOURCE_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeResource/runtimeResourceLabelsKo";
import { buildOverlayRuntimeResourceSectionVm } from "@/lib/overlay-ui/overlayRuntimeResourceAdapter";
import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";

function buildOverlayInput(compactAndNarrowUi?: boolean) {
  const maturityBaseline = evaluateHarnessMaturityBaseline({
    overlayExtract: null,
    harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
    recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
    messageExplainabilityAvailable: true,
  });
  return {
    overlay: null,
    maturityBaseline,
    releaseGate: evaluateHarnessReleaseGateReadiness(maturityBaseline),
    messageExplainabilityAvailable: true,
    overlayWarningCount: 0,
    compactAndNarrowUi,
  } as const;
}

describe("buildOverlayRuntimeResourceSectionVm", () => {
  it("includes H20.5 disclaimer and pressure rows", () => {
    const vm = buildOverlayRuntimeResourceSectionVm(buildOverlayInput());
    expect(vm.sectionDisclaimer).toBe(RUNTIME_RESOURCE_SECTION_DISCLAIMER_KO);
    expect(vm.pressureRows.length).toBeGreaterThan(0);
    expect(vm.overloadSummaryKo.length).toBeGreaterThan(0);
    expect(vm.providerPressureKo.length).toBeGreaterThan(0);
    expect(vm.queuePressureKo.length).toBeGreaterThan(0);
    expect(vm.bottleneckPropagationKo.length).toBeGreaterThan(0);
  });

  it("collapses to overload summary and member saturation in compact narrow mode", () => {
    const vm = buildOverlayRuntimeResourceSectionVm(buildOverlayInput(true));
    expect(vm.pressureRows.length).toBeLessThanOrEqual(1);
    expect(vm.showDetailSections).toBe(false);
  });
});
