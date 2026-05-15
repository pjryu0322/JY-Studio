/**
 * H15.5 — planning **criticality** 평가(read-only; dependency graph 재사용).
 */

import type { NormalizedRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/runtimePlanningConsolidationTypes";
import type { RuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import type { RuntimePlanningGraphNode } from "@/lib/harness/runtimeDependency/runtimeDependencyTypes";
import type { RuntimePlanningCriticalitySummary } from "./runtimeCriticalityTypes";

function nodeWeight(n: RuntimePlanningGraphNode): number {
  if (n.status === "degraded") return 3;
  if (n.status === "watch") return 2;
  if (n.status === "isolated") return 2;
  return 1;
}

export function evaluateRuntimePlanningCriticality(
  ctx: NormalizedRuntimePlanningContext,
  dependencyReports: RuntimeDependencyPlanningReports
): RuntimePlanningCriticalitySummary {
  const { dependencyGraph } = dependencyReports;
  const { governance } = ctx.governanceCtx;
  const esc = ctx.priorityReports.escalationSummary;

  const criticalNodes: string[] = [];
  const highPriorityNodes: string[] = [];
  const lowPriorityNodes: string[] = [];

  for (const n of dependencyGraph.nodes) {
    const label = `${n.labelKo} (${n.id})`;
    if (n.status === "degraded" || n.status === "isolated") {
      criticalNodes.push(label);
    } else if (n.status === "watch") {
      highPriorityNodes.push(label);
    } else {
      lowPriorityNodes.push(label);
    }
  }

  if (governance.governanceRisk === "high") {
    criticalNodes.push("governance criticality: high risk");
  } else if (governance.governanceRisk === "medium") {
    highPriorityNodes.push("governance criticality: medium risk");
  }

  if (esc.escalationLevel === "critical" || esc.escalationLevel === "escalated") {
    highPriorityNodes.push(`escalation:${esc.escalationLevel}`);
  }

  for (const dep of dependencyGraph.criticalDependencies) {
    if (!criticalNodes.some((c) => c.includes(dep))) {
      highPriorityNodes.push(`critical dependency:${dep}`);
    }
  }

  let score = 20;
  for (const n of dependencyGraph.nodes) {
    score += nodeWeight(n) * 8;
  }
  if (dependencyReports.dependencyConflictSummary.severity === "high") score += 15;
  else if (dependencyReports.dependencyConflictSummary.severity === "medium") score += 8;
  if (esc.operatorAttentionRequired) score += 10;
  const criticalityScore = Math.min(100, Math.max(0, score));

  const recommendations: string[] = [
    "Planning criticality는 메타 진단만 제공합니다. actual orchestration·enforcement 없음.",
    criticalityScore >= 75
      ? "critical·high priority node를 unified summary와 함께 먼저 검토하세요."
      : "주기적으로 dependency graph와 criticality score를 교차 확인하세요.",
  ];

  return {
    mode: "runtime_planning_criticality_summary",
    actualRuntimeOrchestrationEnabled: false,
    criticalNodes: [...new Set(criticalNodes)].slice(0, 10),
    highPriorityNodes: [...new Set(highPriorityNodes)].slice(0, 10),
    lowPriorityNodes: [...new Set(lowPriorityNodes)].slice(0, 10),
    criticalityScore,
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeRuntimePlanningCriticalitySummaryForDiagnostic(
  summary: RuntimePlanningCriticalitySummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    criticalNodes: [...summary.criticalNodes],
    highPriorityNodes: [...summary.highPriorityNodes],
    lowPriorityNodes: [...summary.lowPriorityNodes],
    criticalityScore: summary.criticalityScore,
    recommendations: [...summary.recommendations],
  };
}
