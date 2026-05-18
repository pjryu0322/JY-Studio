import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildOverlayRuntimePlanningConsolidatedSectionVm } from "@/lib/overlay-ui/overlayRuntimePlanningConsolidatedAdapter";
import { buildOverlayRuntimePlanningSectionVms } from "@/lib/overlay-ui/overlayRuntimePlanningSectionVms";
import { resolveOverlaySectionUiPolicy } from "@/lib/overlay-ui/overlaySectionOpenPolicy";

describe("overlay runtime planning consolidation", () => {
  it("returns consolidated vm aligned with planning section vms", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const releaseGate = evaluateHarnessReleaseGateReadiness(baseline);
    const input = {
      overlay: null,
      maturityBaseline: baseline,
      releaseGate,
      messageExplainabilityAvailable: true,
      overlayWarningCount: 0,
    };
    const vms = buildOverlayRuntimePlanningSectionVms(input);
    const consolidated = buildOverlayRuntimePlanningConsolidatedSectionVm(input);
    expect(consolidated.stabilityHeadline).toBe(vms.consolidatedVm.stabilityHeadline);
    expect(consolidated.coherenceHeadline).toBe(vms.consolidatedVm.coherenceHeadline);
  });

  it("omits lifecycle and coherence sections in compact narrow mode", () => {
    const life = resolveOverlaySectionUiPolicy({
      section: "runtime_lifecycle",
      baseDefaultOpen: false,
      compactMode: true,
      isNarrow: true,
      audience: "operator",
    });
    const coh = resolveOverlaySectionUiPolicy({
      section: "runtime_coherence",
      baseDefaultOpen: false,
      compactMode: true,
      isNarrow: true,
      audience: "operator",
    });
    expect(life.omitFromDom).toBe(true);
    expect(coh.omitFromDom).toBe(true);
  });
});
