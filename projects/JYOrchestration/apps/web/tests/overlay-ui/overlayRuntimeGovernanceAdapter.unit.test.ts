import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildOverlayRuntimeGovernanceSectionVm } from "@/lib/overlay-ui/overlayRuntimeGovernanceAdapter";

describe("buildOverlayRuntimeGovernanceSectionVm", () => {
  it("includes governance disclaimer and audit rows", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const releaseGate = evaluateHarnessReleaseGateReadiness(baseline);
    const vm = buildOverlayRuntimeGovernanceSectionVm({
      overlay: null,
      maturityBaseline: baseline,
      releaseGate,
    });
    expect(vm.sectionDisclaimer).toContain("read-only");
    expect(vm.auditabilityRows.length).toBeGreaterThan(0);
  });
});
