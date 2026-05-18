import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildOverlayRuntimeDependencyGraphSectionVm } from "@/lib/overlay-ui/overlayRuntimeDependencyAdapter";
import { RUNTIME_DEPENDENCY_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeDependency/runtimeDependencyLabelsKo";

describe("buildOverlayRuntimeDependencyGraphSectionVm", () => {
  it("includes H15 disclaimer and dependency labels", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const releaseGate = evaluateHarnessReleaseGateReadiness(baseline);
    const vm = buildOverlayRuntimeDependencyGraphSectionVm({
      overlay: null,
      maturityBaseline: baseline,
      releaseGate,
      messageExplainabilityAvailable: true,
      overlayWarningCount: 0,
    });
    expect(vm.sectionDisclaimer).toBe(RUNTIME_DEPENDENCY_SECTION_DISCLAIMER_KO);
    expect(vm.conflictSeverityLabel.length).toBeGreaterThan(0);
    expect(vm.nodeRows.length).toBeGreaterThan(0);
    expect(vm.edgeRows.length).toBeGreaterThan(0);
  });
});
