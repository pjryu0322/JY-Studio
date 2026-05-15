import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildOverlayRuntimeReasoningSectionVm } from "@/lib/overlay-ui/overlayRuntimeReasoningAdapter";
import { RUNTIME_REASONING_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeReasoning/runtimeReasoningLabelsKo";

describe("buildOverlayRuntimeReasoningSectionVm", () => {
  it("includes H16.5 disclaimer and unified reasoning rows", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const releaseGate = evaluateHarnessReleaseGateReadiness(baseline);
    const vm = buildOverlayRuntimeReasoningSectionVm({
      overlay: null,
      maturityBaseline: baseline,
      releaseGate,
      messageExplainabilityAvailable: true,
      overlayWarningCount: 0,
    });
    expect(vm.sectionDisclaimer).toBe(RUNTIME_REASONING_SECTION_DISCLAIMER_KO);
    expect(vm.stableOrderingRows.length).toBeGreaterThan(0);
    expect(vm.propagationReasoningRows.length + vm.dependencyReasoningRows.length).toBeGreaterThan(0);
  });
});
