import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildOverlayRuntimeLifecycleSectionVm } from "@/lib/overlay-ui/overlayRuntimeLifecycleAdapter";
import { RUNTIME_LIFECYCLE_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeLifecycle/runtimeLifecycleLabelsKo";

describe("buildOverlayRuntimeLifecycleSectionVm", () => {
  it("includes H13.5 disclaimer and lifecycle labels", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const releaseGate = evaluateHarnessReleaseGateReadiness(baseline);
    const vm = buildOverlayRuntimeLifecycleSectionVm({
      overlay: null,
      maturityBaseline: baseline,
      releaseGate,
      messageExplainabilityAvailable: true,
      overlayWarningCount: 0,
    });
    expect(vm.sectionDisclaimer).toBe(RUNTIME_LIFECYCLE_SECTION_DISCLAIMER_KO);
    expect(vm.freshnessLabel.length).toBeGreaterThan(0);
    expect(vm.lifecycleStateLabel.length).toBeGreaterThan(0);
    expect(vm.driftSeverityLabel.length).toBeGreaterThan(0);
  });
});
