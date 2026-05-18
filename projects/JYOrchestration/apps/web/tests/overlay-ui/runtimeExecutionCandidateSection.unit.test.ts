import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildOverlayRuntimeExecutionCandidateSectionVm } from "@/lib/overlay-ui/overlayRuntimeExecutionCandidateAdapter";

import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimeExecutionCandidateSectionVm", () => {
  it("includes disclaimer and candidate labels", () => {
    const vm = buildOverlayRuntimeExecutionCandidateSectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer.length).toBeGreaterThan(0);
    expect(vm.candidateStatusKo.length).toBeGreaterThan(0);
    expect(vm.candidateRiskKo.length).toBeGreaterThan(0);
  });

  it("collapses scope rows in compact narrow mode", () => {
    const full = buildOverlayRuntimeExecutionCandidateSectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimeExecutionCandidateSectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(compact.showDetailSections).toBe(false);
    if (full.scopeInputRows.length > 1) {
      expect(compact.scopeInputRows.length).toBeLessThanOrEqual(1);
    }
  });
});
