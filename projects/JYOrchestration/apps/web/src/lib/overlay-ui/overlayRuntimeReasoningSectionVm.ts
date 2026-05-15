/**
 * H16.5 — Overlay reasoning 섹션 ViewModel 타입·reports → VM 변환.
 */

import type { RuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import { RUNTIME_REASONING_SECTION_DISCLAIMER_KO } from "@/lib/harness/runtimeReasoning/runtimeReasoningLabelsKo";

export type OverlayRuntimeReasoningSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  stableOrderingRows: readonly string[];
  propagationReasoningRows: readonly string[];
  dependencyReasoningRows: readonly string[];
  criticalTransitionRows: readonly string[];
  redundancyNote: string;
}>;

export function buildOverlayRuntimeReasoningSectionVmFromReports(
  reports: RuntimeReasoningPlanningReports
): OverlayRuntimeReasoningSectionVM {
  const { unifiedReasoningChain, reasoningRedundancySummary, normalizedReasoningTrace } = reports;
  return {
    sectionDisclaimer: RUNTIME_REASONING_SECTION_DISCLAIMER_KO,
    showAttention:
      reasoningRedundancySummary.duplicatePropagationTraceRisk !== "low" ||
      reasoningRedundancySummary.duplicateReasoningGenerationRisk !== "low" ||
      unifiedReasoningChain.criticalTransitions.length >= 2,
    stableOrderingRows: unifiedReasoningChain.stableOrdering,
    propagationReasoningRows: normalizedReasoningTrace.normalizedDependencyTraces,
    dependencyReasoningRows: [
      ...normalizedReasoningTrace.normalizedDependencyTraces,
      ...unifiedReasoningChain.reasoningEdges,
    ],
    criticalTransitionRows: unifiedReasoningChain.criticalTransitions,
    redundancyNote: reasoningRedundancySummary.findings[0] ?? "Reasoning consolidation 적용됨.",
  };
}
