/**
 * H16 — **priority reasoning trace**(read-only; H15.5 reports 재사용).
 */

import type { RuntimeCriticalityPlanningReports } from "@/lib/harness/runtimeCriticality/buildRuntimeCriticalityPlanningReports";
import type { RuntimePriorityReasoningTraceSummary } from "./runtimeTraceabilityTypes";

export function evaluatePriorityReasoningTrace(
  criticalityReports: RuntimeCriticalityPlanningReports
): RuntimePriorityReasoningTraceSummary {
  const { criticalitySummary, priorityPropagationSummary, escalationPriorityFlowSummary } =
    criticalityReports;

  const escalationPriorityReasoning = [
    ...escalationPriorityFlowSummary.staleEscalationPriorities,
    ...escalationPriorityFlowSummary.governanceEscalationPriorities,
    ...priorityPropagationSummary.escalationPriorityPaths,
  ];
  const criticalNodeReasoning = [
    ...criticalitySummary.criticalNodes.map((n) => `critical:${n}`),
    ...criticalitySummary.highPriorityNodes.slice(0, 4).map((n) => `high:${n}`),
  ];
  const propagationReasoning = [
    ...priorityPropagationSummary.dependencyPriorityPaths,
    ...priorityPropagationSummary.lifecyclePriorityPaths,
  ];
  const impactReasoning = [
    ...priorityPropagationSummary.governancePriorityImpacts,
    ...escalationPriorityFlowSummary.criticalDependencyEscalations,
  ];

  const recommendations: string[] = [
    "Priority reasoning trace는 planning 우선순위 메타만 표시합니다. enforcement 없음.",
    criticalitySummary.criticalityScore >= 75
      ? "critical node reasoning을 unified summary와 교차 확인하세요."
      : "priority trace는 관측 범위에서 안정적입니다.",
  ];

  return {
    mode: "runtime_priority_reasoning_trace_summary",
    actualRuntimeOrchestrationEnabled: false,
    escalationPriorityReasoning: [...new Set(escalationPriorityReasoning)].slice(0, 8),
    criticalNodeReasoning: [...new Set(criticalNodeReasoning)].slice(0, 8),
    propagationReasoning: [...new Set(propagationReasoning)].slice(0, 8),
    impactReasoning: [...new Set(impactReasoning)].slice(0, 8),
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeRuntimePriorityReasoningTraceSummaryForDiagnostic(
  summary: RuntimePriorityReasoningTraceSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    escalationPriorityReasoning: [...summary.escalationPriorityReasoning],
    criticalNodeReasoning: [...summary.criticalNodeReasoning],
    propagationReasoning: [...summary.propagationReasoning],
    impactReasoning: [...summary.impactReasoning],
    recommendations: [...summary.recommendations],
  };
}
