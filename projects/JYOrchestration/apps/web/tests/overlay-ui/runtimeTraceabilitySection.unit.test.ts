import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildOverlayRuntimeTraceabilitySectionVm } from "@/lib/overlay-ui/overlayRuntimeTraceabilityAdapter";
import { RUNTIME_TRACEABILITY_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeTraceability/runtimeTraceabilityLabelsKo";

describe("buildOverlayRuntimeTraceabilitySectionVm", () => {
  it("includes H16 disclaimer and trace rows", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const releaseGate = evaluateHarnessReleaseGateReadiness(baseline);
    const vm = buildOverlayRuntimeTraceabilitySectionVm({
      overlay: null,
      maturityBaseline: baseline,
      releaseGate,
      messageExplainabilityAvailable: true,
      overlayWarningCount: 0,
    });
    expect(vm.sectionDisclaimer).toBe(RUNTIME_TRACEABILITY_SECTION_DISCLAIMER_KO);
    expect(vm.reasoningStepRows.length).toBeGreaterThan(0);
    expect(vm.dependencyTracePaths.length + vm.priorityTracePaths.length).toBeGreaterThan(0);
  });
});
