/**
 * H15.5 — planning **priority propagation** 평가(read-only; H15 impact propagation과 분리).
 */

import type { NormalizedRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/runtimePlanningConsolidationTypes";
import type { RuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import type { RuntimePriorityPropagationSummary } from "./runtimeCriticalityTypes";

export function evaluatePriorityPropagation(
  ctx: NormalizedRuntimePlanningContext,
  dependencyReports: RuntimeDependencyPlanningReports
): RuntimePriorityPropagationSummary {
  const dependencyPriorityPaths: string[] = [];
  const lifecyclePriorityPaths: string[] = [];
  const escalationPriorityPaths: string[] = [];
  const governancePriorityImpacts: string[] = [];

  for (const e of dependencyReports.dependencyGraph.edges) {
    dependencyPriorityPaths.push(`${e.from} → ${e.to} (${e.relationKo})`);
  }
  for (const chain of dependencyReports.dependencyGraph.dependencyChains) {
    dependencyPriorityPaths.push(`chain:${chain}`);
  }

  const { freshnessSummary, invalidationSummary } = ctx.lifecycleReports;
  if (freshnessSummary.freshnessLevel !== "fresh") {
    lifecyclePriorityPaths.push(`freshness:${freshnessSummary.freshnessLevel} → escalation priority`);
  }
  if (invalidationSummary.lifecycleState !== "active") {
    lifecyclePriorityPaths.push(`lifecycle:${invalidationSummary.lifecycleState} → coherence priority`);
  }

  const esc = ctx.priorityReports.escalationSummary;
  escalationPriorityPaths.push(`escalation level:${esc.escalationLevel}`);
  for (const area of esc.criticalAreas) {
    escalationPriorityPaths.push(`critical area:${area}`);
  }
  for (const reason of esc.escalationReasons.slice(0, 4)) {
    escalationPriorityPaths.push(`reason:${reason}`);
  }

  const { governance } = ctx.governanceCtx;
  if (governance.governanceRisk !== "low") {
    governancePriorityImpacts.push(`governance risk ${governance.governanceRisk} → priority ordering`);
  }
  if (ctx.stabilityReports.controlledGovernance.governanceReadinessEligible === false) {
    governancePriorityImpacts.push("governance readiness blocked → downstream deprioritized");
  }

  const recommendations: string[] = [
    "Priority propagation은 planning 우선순위 메타만 표시합니다. actual routing 없음.",
    dependencyPriorityPaths.length > 4
      ? "dependency chain 우선순위를 criticality summary와 함께 확인하세요."
      : "전파 경로는 관측 범위에서 낮습니다.",
  ];

  return {
    mode: "runtime_priority_propagation_summary",
    actualRuntimeOrchestrationEnabled: false,
    dependencyPriorityPaths: [...new Set(dependencyPriorityPaths)].slice(0, 8),
    lifecyclePriorityPaths: [...new Set(lifecyclePriorityPaths)].slice(0, 8),
    escalationPriorityPaths: [...new Set(escalationPriorityPaths)].slice(0, 8),
    governancePriorityImpacts: [...new Set(governancePriorityImpacts)].slice(0, 8),
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeRuntimePriorityPropagationSummaryForDiagnostic(
  summary: RuntimePriorityPropagationSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    dependencyPriorityPaths: [...summary.dependencyPriorityPaths],
    lifecyclePriorityPaths: [...summary.lifecyclePriorityPaths],
    escalationPriorityPaths: [...summary.escalationPriorityPaths],
    governancePriorityImpacts: [...summary.governancePriorityImpacts],
    recommendations: [...summary.recommendations],
  };
}
