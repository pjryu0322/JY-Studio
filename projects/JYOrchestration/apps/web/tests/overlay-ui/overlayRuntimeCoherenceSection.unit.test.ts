import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildOverlayRuntimeCoherenceSectionVm } from "@/lib/overlay-ui/overlayRuntimeCoherenceAdapter";
import { RUNTIME_COHERENCE_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeCoherence/runtimeCoherenceLabelsKo";

describe("buildOverlayRuntimeCoherenceSectionVm", () => {
  it("includes H14 disclaimer and coherence labels", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const releaseGate = evaluateHarnessReleaseGateReadiness(baseline);
    const vm = buildOverlayRuntimeCoherenceSectionVm({
      overlay: null,
      maturityBaseline: baseline,
      releaseGate,
      messageExplainabilityAvailable: true,
      overlayWarningCount: 0,
    });
    expect(vm.sectionDisclaimer).toBe(RUNTIME_COHERENCE_SECTION_DISCLAIMER_KO);
    expect(vm.coherenceLabel.length).toBeGreaterThan(0);
    expect(vm.synchronizationLabel.length).toBeGreaterThan(0);
    expect(vm.divergenceSeverityLabel.length).toBeGreaterThan(0);
  });
});
