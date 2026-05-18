import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildOverlayRuntimeCriticalitySectionVm } from "@/lib/overlay-ui/overlayRuntimeCriticalityAdapter";
import { RUNTIME_CRITICALITY_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeCriticality/runtimeCriticalityLabelsKo";

describe("buildOverlayRuntimeCriticalitySectionVm", () => {
  it("includes H15.5 disclaimer and criticality labels", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const releaseGate = evaluateHarnessReleaseGateReadiness(baseline);
    const vm = buildOverlayRuntimeCriticalitySectionVm({
      overlay: null,
      maturityBaseline: baseline,
      releaseGate,
      messageExplainabilityAvailable: true,
      overlayWarningCount: 0,
    });
    expect(vm.sectionDisclaimer).toBe(RUNTIME_CRITICALITY_SECTION_DISCLAIMER_KO);
    expect(vm.criticalityScoreLabel.length).toBeGreaterThan(0);
    expect(vm.priorityPropagationPaths.length).toBeGreaterThan(0);
  });
});
