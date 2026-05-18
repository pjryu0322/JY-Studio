import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildOverlayRuntimeTrialSectionVm } from "@/lib/overlay-ui/overlayRuntimeTrialAdapter";

describe("buildOverlayRuntimeTrialSectionVm", () => {
  it("builds section VM with simulation labels", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: { overlayIdentity: { roleKey: "planner", perspective: "기획", provider: "openai", capabilities: [] } },
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const gate = evaluateHarnessReleaseGateReadiness(baseline);
    const vm = buildOverlayRuntimeTrialSectionVm({
      overlay: { overlayIdentity: { roleKey: "planner", perspective: "기획", provider: "openai", capabilities: [] } },
      maturityBaseline: baseline,
      releaseGate: gate,
    });
    expect(vm.readinessLevelLabel.length).toBeGreaterThan(1);
    expect(vm.simulatedActionLabels.length).toBeGreaterThan(0);
  });
});
