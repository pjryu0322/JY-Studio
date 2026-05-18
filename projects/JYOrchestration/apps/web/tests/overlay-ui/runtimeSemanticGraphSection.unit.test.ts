import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { RUNTIME_SEMANTIC_GRAPH_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeSemanticGraph/runtimeSemanticGraphLabelsKo";
import { buildOverlayRuntimeSemanticGraphSectionVm } from "@/lib/overlay-ui/overlayRuntimeSemanticGraphAdapter";

function buildOverlayInput() {
  const maturityBaseline = evaluateHarnessMaturityBaseline({
    overlayExtract: null,
    harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
    recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
    messageExplainabilityAvailable: true,
  });
  return {
    overlay: null,
    maturityBaseline,
    releaseGate: evaluateHarnessReleaseGateReadiness(maturityBaseline),
    messageExplainabilityAvailable: true,
    overlayWarningCount: 0,
  } as const;
}

describe("buildOverlayRuntimeSemanticGraphSectionVm", () => {
  it("includes H18 disclaimer and capped causal path rows", () => {
    const vm = buildOverlayRuntimeSemanticGraphSectionVm(buildOverlayInput());
    expect(vm.sectionDisclaimer).toBe(RUNTIME_SEMANTIC_GRAPH_SECTION_DISCLAIMER_KO);
    expect(vm.explosionRiskLabel.length).toBeGreaterThan(0);
    expect(vm.causalPathRows.length).toBeLessThanOrEqual(5);
  });
});
