import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { RUNTIME_SEMANTIC_VOCABULARY_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeSemanticVocabulary/runtimeSemanticVocabularyLabelsKo";
import { buildOverlayRuntimeSemanticVocabularySectionVm } from "@/lib/overlay-ui/overlayRuntimeSemanticVocabularyAdapter";

function buildOverlayInput(compactAndNarrowUi?: boolean) {
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
    compactAndNarrowUi,
  } as const;
}

describe("buildOverlayRuntimeSemanticVocabularySectionVm", () => {
  it("includes H19 disclaimer and canonical label rows", () => {
    const vm = buildOverlayRuntimeSemanticVocabularySectionVm(buildOverlayInput());
    expect(vm.sectionDisclaimer).toBe(RUNTIME_SEMANTIC_VOCABULARY_SECTION_DISCLAIMER_KO);
    expect(vm.canonicalLabelRows.length).toBeGreaterThan(0);
    expect(vm.canonicalLabelRows.length).toBeLessThanOrEqual(6);
  });

  it("limits canonical labels in compact narrow mode", () => {
    const vm = buildOverlayRuntimeSemanticVocabularySectionVm(buildOverlayInput(true));
    expect(vm.canonicalLabelRows.length).toBeLessThanOrEqual(3);
    expect(vm.showDetailSections).toBe(false);
  });
});
