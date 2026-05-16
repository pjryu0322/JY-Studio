import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildOverlayRuntimeResourceGovernanceSectionVm } from "@/lib/overlay-ui/overlayRuntimeResourceGovernanceAdapter";

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

describe("buildOverlayRuntimeResourceGovernanceSectionVm", () => {
  it("includes disclaimer and core governance rows", () => {
    const vm = buildOverlayRuntimeResourceGovernanceSectionVm(buildOverlayInput());
    expect(vm.governanceRiskKo.length).toBeGreaterThan(0);
    expect(vm.controlBoundaryKo.length).toBeGreaterThan(0);
    expect(vm.sectionDisclaimer.length).toBeGreaterThan(0);
  });

  it("collapses detail rows in compact narrow mode", () => {
    const vm = buildOverlayRuntimeResourceGovernanceSectionVm(buildOverlayInput(true));
    expect(vm.showDetailSections).toBe(false);
    expect(vm.findingRows.length).toBeLessThanOrEqual(1);
    expect(vm.recommendationRows.length).toBeLessThanOrEqual(1);
  });
});
