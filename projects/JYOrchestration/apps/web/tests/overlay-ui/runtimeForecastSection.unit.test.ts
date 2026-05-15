import { describe, expect, it } from "vitest";

import { RUNTIME_FORECAST_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeForecast/runtimeForecastLabelsKo";
import { buildOverlayRuntimeForecastSectionVm } from "@/lib/overlay-ui/overlayRuntimeForecastAdapter";
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

describe("buildOverlayRuntimeForecastSectionVm", () => {
  it("includes H20 disclaimer and trend rows", () => {
    const vm = buildOverlayRuntimeForecastSectionVm(buildOverlayInput());
    expect(vm.sectionDisclaimer).toBe(RUNTIME_FORECAST_SECTION_DISCLAIMER_KO);
    expect(vm.trendRows.length).toBeGreaterThan(0);
    expect(vm.escalationSummaryKo.length).toBeGreaterThan(0);
  });

  it("collapses to escalation summary only in compact narrow mode", () => {
    const vm = buildOverlayRuntimeForecastSectionVm(buildOverlayInput(true));
    expect(vm.trendRows.length).toBeLessThanOrEqual(2);
    expect(vm.escalationRows.length).toBe(1);
    expect(vm.showDetailSections).toBe(false);
  });
});
