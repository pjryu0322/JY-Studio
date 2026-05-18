/**
 * H16.5 — reasoning trace **normalization**(stable ordering·중복 제거).
 */

import type { RuntimeTraceabilityPlanningReports } from "@/lib/harness/runtimeTraceability/buildRuntimeTraceabilityPlanningReports";
import type { NormalizedRuntimeReasoningTrace, UnifiedRuntimeReasoningChain } from "./runtimeReasoningTypes";

function dedupeOrdered(items: readonly string[]): { kept: string[]; removed: string[] } {
  const seen = new Set<string>();
  const kept: string[] = [];
  const removed: string[] = [];
  for (const item of items) {
    const key = item.trim().toLowerCase();
    if (seen.has(key)) {
      removed.push(item);
    } else {
      seen.add(key);
      kept.push(item);
    }
  }
  return { kept, removed };
}

export function normalizeRuntimeReasoningTrace(
  traceabilityReports: RuntimeTraceabilityPlanningReports,
  unifiedReasoningChain: UnifiedRuntimeReasoningChain
): NormalizedRuntimeReasoningTrace {
  const { dependencyReasoningTraceSummary, priorityReasoningTraceSummary } = traceabilityReports;

  const rawDep = [
    ...dependencyReasoningTraceSummary.staleDependencyReasoning,
    ...dependencyReasoningTraceSummary.propagationReasoning,
    ...dependencyReasoningTraceSummary.lifecycleDependencyReasoning,
    ...dependencyReasoningTraceSummary.governanceDependencyReasoning,
  ];
  const rawPri = [
    ...priorityReasoningTraceSummary.escalationPriorityReasoning,
    ...priorityReasoningTraceSummary.criticalNodeReasoning,
    ...priorityReasoningTraceSummary.propagationReasoning,
    ...priorityReasoningTraceSummary.impactReasoning,
  ];

  const depDeduped = dedupeOrdered(rawDep);
  const priDeduped = dedupeOrdered(rawPri);

  const recommendations: string[] = [
    "Normalized trace는 overlay-safe planning 메타만 제공합니다. payload 변경 없음.",
    depDeduped.removed.length + priDeduped.removed.length > 0
      ? "중복 trace는 unified reasoning chain에서 확인하세요."
      : "trace normalization 후 중복이 낮습니다.",
  ];

  return {
    mode: "normalized_runtime_reasoning_trace",
    actualRuntimeOrchestrationEnabled: false,
    stableOrderedSteps: unifiedReasoningChain.stableOrdering,
    normalizedDependencyTraces: depDeduped.kept.slice(0, 8),
    normalizedPriorityTraces: priDeduped.kept.slice(0, 8),
    removedDuplicates: [...depDeduped.removed, ...priDeduped.removed].slice(0, 8),
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeNormalizedRuntimeReasoningTraceForDiagnostic(
  trace: NormalizedRuntimeReasoningTrace
): Readonly<Record<string, unknown>> {
  return {
    mode: trace.mode,
    actualRuntimeOrchestrationEnabled: trace.actualRuntimeOrchestrationEnabled,
    stableOrderedSteps: [...trace.stableOrderedSteps],
    normalizedDependencyTraces: [...trace.normalizedDependencyTraces],
    normalizedPriorityTraces: [...trace.normalizedPriorityTraces],
    removedDuplicates: [...trace.removedDuplicates],
    recommendations: [...trace.recommendations],
  };
}
