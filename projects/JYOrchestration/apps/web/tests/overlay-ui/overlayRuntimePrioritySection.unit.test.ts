import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildOverlayRuntimePrioritySectionVm } from "@/lib/overlay-ui/overlayRuntimePriorityAdapter";
import { RUNTIME_PRIORITY_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimePriority/runtimePriorityLabelsKo";

describe("buildOverlayRuntimePrioritySectionVm", () => {
  it("includes H12.5 disclaimer and priority labels", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const releaseGate = evaluateHarnessReleaseGateReadiness(baseline);
    const vm = buildOverlayRuntimePrioritySectionVm({
      overlay: null,
      maturityBaseline: baseline,
      releaseGate,
      messageExplainabilityAvailable: true,
      overlayWarningCount: 0,
    });
    expect(vm.sectionDisclaimer).toBe(RUNTIME_PRIORITY_SECTION_DISCLAIMER_KO);
    expect(vm.overallPlanningPriorityLabel.length).toBeGreaterThan(0);
    expect(vm.escalationLevelLabel.length).toBeGreaterThan(0);
  });
});
