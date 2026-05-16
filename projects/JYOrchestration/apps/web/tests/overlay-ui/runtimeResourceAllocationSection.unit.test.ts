import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildOverlayRuntimeResourceAllocationSectionVm } from "@/lib/overlay-ui/overlayRuntimeResourceAllocationAdapter";

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

describe("buildOverlayRuntimeResourceAllocationSectionVm", () => {
  it("includes disclaimer and planning rows", () => {
    const vm = buildOverlayRuntimeResourceAllocationSectionVm(buildOverlayInput());
    expect(vm.sectionDisclaimer.length).toBeGreaterThan(0);
    expect(vm.globalAllocationModeKo.length).toBeGreaterThan(0);
    expect(vm.memberRows.length).toBeGreaterThan(0);
  });

  it("collapses member and recommendation rows in compact narrow mode", () => {
    const vm = buildOverlayRuntimeResourceAllocationSectionVm(buildOverlayInput(true));
    expect(vm.showDetailSections).toBe(false);
    expect(vm.memberRows.length).toBeLessThanOrEqual(2);
    expect(vm.recommendationRows.length).toBeLessThanOrEqual(1);
  });
});
