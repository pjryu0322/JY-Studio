/**
 * H16.5 — 분산 reasoning을 **unified chain**으로 통합(read-only; H16 reports 재사용).
 */

import type { RuntimeTraceabilityPlanningReports } from "@/lib/harness/runtimeTraceability/buildRuntimeTraceabilityPlanningReports";
import type { UnifiedRuntimeReasoningChain } from "./runtimeReasoningTypes";

const KIND_ORDER: Record<string, number> = {
  governance: 0,
  lifecycle: 1,
  dependency: 2,
  escalation: 3,
  criticality: 4,
  coherence: 5,
};

export function buildUnifiedRuntimeReasoningChain(
  traceabilityReports: RuntimeTraceabilityPlanningReports
): UnifiedRuntimeReasoningChain {
  const { reasoningChain, dependencyReasoningTraceSummary, priorityReasoningTraceSummary } =
    traceabilityReports;

  const stableOrdering = [...reasoningChain.reasoningSteps]
    .sort((a, b) => (KIND_ORDER[a.kind] ?? 99) - (KIND_ORDER[b.kind] ?? 99) || a.id.localeCompare(b.id))
    .map((s) => `${s.labelKo} (${s.kind})`);

  const reasoningNodes = [...new Set(reasoningChain.nodes)].slice(0, 12);
  const reasoningEdges = [
    ...reasoningChain.dependencies,
    ...dependencyReasoningTraceSummary.propagationReasoning.slice(0, 2).map((p) => `prop:${p}`),
  ].slice(0, 10);
  const criticalTransitions = [
    ...reasoningChain.criticalTransitions,
    ...priorityReasoningTraceSummary.escalationPriorityReasoning.slice(0, 2),
  ].slice(0, 8);

  const recommendations: string[] = [
    "Unified reasoning chain은 planning 메타만 통합합니다. actual orchestration 없음.",
    stableOrdering.length > 6
      ? "stable ordering 기준으로 governance → lifecycle → dependency 순을 확인하세요."
      : "reasoning chain은 관측 범위에서 단순합니다.",
  ];

  return {
    mode: "unified_runtime_reasoning_chain",
    actualRuntimeOrchestrationEnabled: false,
    reasoningNodes,
    reasoningEdges,
    criticalTransitions: [...new Set(criticalTransitions)],
    stableOrdering: [...new Set(stableOrdering)].slice(0, 12),
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeUnifiedRuntimeReasoningChainForDiagnostic(
  chain: UnifiedRuntimeReasoningChain
): Readonly<Record<string, unknown>> {
  return {
    mode: chain.mode,
    actualRuntimeOrchestrationEnabled: chain.actualRuntimeOrchestrationEnabled,
    reasoningNodes: [...chain.reasoningNodes],
    reasoningEdges: [...chain.reasoningEdges],
    criticalTransitions: [...chain.criticalTransitions],
    stableOrdering: [...chain.stableOrdering],
    recommendations: [...chain.recommendations],
  };
}
