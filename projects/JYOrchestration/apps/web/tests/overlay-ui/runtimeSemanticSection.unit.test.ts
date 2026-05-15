import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildOverlayRuntimeSemanticSectionVm } from "@/lib/overlay-ui/overlayRuntimeSemanticAdapter";
import { RUNTIME_SEMANTIC_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeSemantic/runtimeSemanticLabelsKo";

describe("buildOverlayRuntimeSemanticSectionVm", () => {
  it("includes H17 disclaimer and compressed semantic rows", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const releaseGate = evaluateHarnessReleaseGateReadiness(baseline);
    const vm = buildOverlayRuntimeSemanticSectionVm({
      overlay: null,
      maturityBaseline: baseline,
      releaseGate,
      messageExplainabilityAvailable: true,
      overlayWarningCount: 0,
    });
    expect(vm.sectionDisclaimer).toBe(RUNTIME_SEMANTIC_SECTION_DISCLAIMER_KO);
    expect(vm.semanticGroupRows.length).toBeGreaterThan(0);
    expect(vm.compressedTraceRows.length).toBeGreaterThan(0);
    expect(vm.stabilizedOrderingRows.length).toBeGreaterThan(0);
  });
});
