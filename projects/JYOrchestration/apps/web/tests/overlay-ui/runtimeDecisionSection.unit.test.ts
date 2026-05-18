import { describe, expect, it } from "vitest";

import { RUNTIME_DECISION_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeDecision/runtimeDecisionLabelsKo";
import { buildOverlayRuntimeDecisionSectionVm } from "@/lib/overlay-ui/overlayRuntimeDecisionAdapter";
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

describe("buildOverlayRuntimeDecisionSectionVm", () => {
  it("includes H19.5 disclaimer and lineage paths", () => {
    const vm = buildOverlayRuntimeDecisionSectionVm(buildOverlayInput());
    expect(vm.sectionDisclaimer).toBe(RUNTIME_DECISION_SECTION_DISCLAIMER_KO);
    expect(vm.lineagePathRows.length).toBeGreaterThan(0);
    expect(vm.lineagePathRows.length).toBeLessThanOrEqual(5);
  });

  it("collapses to recommendation summary only in compact narrow mode", () => {
    const vm = buildOverlayRuntimeDecisionSectionVm(buildOverlayInput(true));
    expect(vm.lineagePathRows.length).toBeLessThanOrEqual(2);
    expect(vm.recommendationRows.length).toBe(1);
    expect(vm.showDetailSections).toBe(false);
  });
});
