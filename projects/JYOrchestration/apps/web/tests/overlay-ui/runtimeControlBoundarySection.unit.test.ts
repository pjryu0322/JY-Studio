import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildOverlayRuntimeControlBoundarySectionVm } from "@/lib/overlay-ui/overlayRuntimeControlBoundaryAdapter";

import { buildDefaultOverlaySectionVmTestInput } from "./overlaySectionVmTestInput";

describe("buildOverlayRuntimeControlBoundarySectionVm", () => {
  it("includes disclaimer and boundary labels", () => {
    const vm = buildOverlayRuntimeControlBoundarySectionVm(buildDefaultOverlaySectionVmTestInput());
    expect(vm.sectionDisclaimer.length).toBeGreaterThan(0);
    expect(vm.boundaryLevelKo.length).toBeGreaterThan(0);
    expect(vm.boundaryRiskKo.length).toBeGreaterThan(0);
  });

  it("collapses violation and scope rows in compact narrow mode", () => {
    const full = buildOverlayRuntimeControlBoundarySectionVm(buildDefaultOverlaySectionVmTestInput(false));
    const compact = buildOverlayRuntimeControlBoundarySectionVm(buildDefaultOverlaySectionVmTestInput(true));
    expect(compact.showDetailSections).toBe(false);
    if (full.violationFlagRows.length > 1) {
      expect(compact.violationFlagRows.length).toBeLessThanOrEqual(1);
    }
    if (full.forbiddenScopeRows.length > 1) {
      expect(compact.forbiddenScopeRows.length).toBeLessThanOrEqual(1);
    }
  });
});
