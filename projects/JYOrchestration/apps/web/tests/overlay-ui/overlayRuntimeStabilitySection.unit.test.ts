import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildOverlayRuntimeStabilitySectionVm } from "@/lib/overlay-ui/overlayRuntimeStabilityAdapter";
import { RUNTIME_STABILITY_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeStability/runtimeStabilityLabelsKo";

describe("buildOverlayRuntimeStabilitySectionVm", () => {
  it("includes H12 disclaimer and stability labels", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const releaseGate = evaluateHarnessReleaseGateReadiness(baseline);
    const vm = buildOverlayRuntimeStabilitySectionVm({
      overlay: null,
      maturityBaseline: baseline,
      releaseGate,
      messageExplainabilityAvailable: true,
      overlayWarningCount: 0,
    });
    expect(vm.sectionDisclaimer).toBe(RUNTIME_STABILITY_SECTION_DISCLAIMER_KO);
    expect(vm.stabilityLevelLabel.length).toBeGreaterThan(0);
    expect(vm.saturationLevelLabel.length).toBeGreaterThan(0);
  });
});
