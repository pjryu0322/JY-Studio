import { describe, expect, it } from "vitest";

import { RUNTIME_SEMANTIC_NARRATIVE_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeSemanticNarrative/runtimeSemanticNarrativeLabelsKo";
import { buildOverlayRuntimeSemanticNarrativeSectionVm } from "@/lib/overlay-ui/overlayRuntimeSemanticNarrativeAdapter";
import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";

describe("buildOverlayRuntimeSemanticNarrativeSectionVm", () => {
  it("includes H18.5 disclaimer and capped narrative rows", () => {
    const maturityBaseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const vm = buildOverlayRuntimeSemanticNarrativeSectionVm({
      overlay: null,
      maturityBaseline,
      releaseGate: evaluateHarnessReleaseGateReadiness(maturityBaseline),
      messageExplainabilityAvailable: true,
      overlayWarningCount: 0,
    });
    expect(vm.sectionDisclaimer).toBe(RUNTIME_SEMANTIC_NARRATIVE_SECTION_DISCLAIMER_KO);
    expect(vm.narrativeRows.length).toBeLessThanOrEqual(5);
    expect(vm.criticalPathLabel.length).toBeGreaterThan(0);
  });

  it("limits narratives to two in compact narrow mode", () => {
    const maturityBaseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const vm = buildOverlayRuntimeSemanticNarrativeSectionVm({
      overlay: null,
      maturityBaseline,
      releaseGate: evaluateHarnessReleaseGateReadiness(maturityBaseline),
      messageExplainabilityAvailable: true,
      overlayWarningCount: 0,
      compactAndNarrowUi: true,
    });
    expect(vm.narrativeRows.length).toBeLessThanOrEqual(2);
    expect(vm.showDetailSections).toBe(false);
  });
});
