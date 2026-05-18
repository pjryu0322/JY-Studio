/**
 * H16 — **dependency reasoning trace**(read-only; H15 propagation paths 재사용).
 */

import type { NormalizedRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/runtimePlanningConsolidationTypes";
import type { RuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import type { RuntimeDependencyReasoningTraceSummary } from "./runtimeTraceabilityTypes";

export function evaluateDependencyReasoningTrace(
  ctx: NormalizedRuntimePlanningContext,
  dependencyReports: RuntimeDependencyPlanningReports
): RuntimeDependencyReasoningTraceSummary {
  const staleDependencyReasoning: string[] = [];
  const propagationReasoning: string[] = [
    ...dependencyReports.impactPropagationSummary.driftPropagationPaths,
    ...dependencyReports.impactPropagationSummary.stalePropagationPaths,
  ];
  const lifecycleDependencyReasoning: string[] = [];
  const governanceDependencyReasoning: string[] = [];

  for (const dep of ctx.lifecycleReports.invalidationSummary.staleDependencies) {
    staleDependencyReasoning.push(`stale:${dep}`);
  }
  if (ctx.lifecycleReports.freshnessSummary.freshnessLevel !== "fresh") {
    lifecycleDependencyReasoning.push(
      `freshness ${ctx.lifecycleReports.freshnessSummary.freshnessLevel} → dependency ordering`
    );
  }
  if (ctx.lifecycleReports.invalidationSummary.lifecycleState !== "active") {
    lifecycleDependencyReasoning.push(
      `lifecycle ${ctx.lifecycleReports.invalidationSummary.lifecycleState} → invalidation chain`
    );
  }

  const { governance } = ctx.governanceCtx;
  if (governance.governanceRisk !== "low") {
    governanceDependencyReasoning.push(`governance risk ${governance.governanceRisk} → graph root`);
  }
  for (const edge of dependencyReports.dependencyGraph.edges) {
    if (edge.from === "governance" || edge.to === "governance") {
      governanceDependencyReasoning.push(`${edge.from} → ${edge.to}: ${edge.relationKo}`);
    }
  }

  const recommendations: string[] = [
    "Dependency reasoning trace는 planning 메타만 표시합니다. actual routing 없음.",
    propagationReasoning.length > 0
      ? "propagation reasoning을 reasoning chain과 함께 확인하세요."
      : "dependency trace는 관측 범위에서 낮습니다.",
  ];

  return {
    mode: "runtime_dependency_reasoning_trace_summary",
    actualRuntimeOrchestrationEnabled: false,
    staleDependencyReasoning: [...new Set(staleDependencyReasoning)].slice(0, 8),
    propagationReasoning: [...new Set(propagationReasoning)].slice(0, 8),
    lifecycleDependencyReasoning: [...new Set(lifecycleDependencyReasoning)].slice(0, 8),
    governanceDependencyReasoning: [...new Set(governanceDependencyReasoning)].slice(0, 8),
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeRuntimeDependencyReasoningTraceSummaryForDiagnostic(
  summary: RuntimeDependencyReasoningTraceSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    staleDependencyReasoning: [...summary.staleDependencyReasoning],
    propagationReasoning: [...summary.propagationReasoning],
    lifecycleDependencyReasoning: [...summary.lifecycleDependencyReasoning],
    governanceDependencyReasoning: [...summary.governanceDependencyReasoning],
    recommendations: [...summary.recommendations],
  };
}
