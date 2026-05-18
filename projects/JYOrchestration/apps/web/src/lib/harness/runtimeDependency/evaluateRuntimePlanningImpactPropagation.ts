/**
 * H15 — planning **impact propagation** 평가(read-only).
 */

import type { NormalizedRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/runtimePlanningConsolidationTypes";
import type { RuntimePlanningImpactPropagationSummary } from "./runtimeDependencyTypes";

export function evaluateRuntimePlanningImpactPropagation(
  ctx: NormalizedRuntimePlanningContext
): RuntimePlanningImpactPropagationSummary {
  const driftPropagationPaths: string[] = [];
  const stalePropagationPaths: string[] = [];
  const lifecyclePropagationNotes: string[] = [];
  const governanceImpactNotes: string[] = [];
  const resourceImpactNotes: string[] = [];

  const { driftReport, freshnessSummary, invalidationSummary } = ctx.lifecycleReports;
  const { governance } = ctx.governanceCtx;
  const { coherenceSummary, synchronizationSummary, divergenceReport } = ctx.coherenceReports;

  for (const area of driftReport.driftAreas) {
    driftPropagationPaths.push(`${area} → coherence/divergence`);
  }
  if (freshnessSummary.freshnessLevel !== "fresh") {
    stalePropagationPaths.push(`freshness:${freshnessSummary.freshnessLevel} → lifecycle → coherence`);
  }
  for (const dep of invalidationSummary.staleDependencies) {
    stalePropagationPaths.push(`stale dependency:${dep}`);
  }

  if (invalidationSummary.lifecycleState !== "active") {
    lifecyclePropagationNotes.push(`Lifecycle ${invalidationSummary.lifecycleState} → invalidation 후보 전파`);
  }
  if (synchronizationSummary.synchronizationState !== "synchronized") {
    lifecyclePropagationNotes.push(`Sync ${synchronizationSummary.synchronizationState} → lagging layers`);
  }

  if (governance.governanceRisk !== "low") {
    governanceImpactNotes.push(`Governance risk ${governance.governanceRisk} → stability·enforcement planning`);
  }
  if (ctx.stabilityReports.controlledGovernance.governanceReadinessEligible === false) {
    governanceImpactNotes.push("Governance readiness blocked → downstream priority");
  }

  if (ctx.stabilityReports.overlayOverload.overlayOverloadRisk === "high") {
    resourceImpactNotes.push("Resource overload → stability saturation");
  }
  if (ctx.stabilityReports.saturationSummary.saturationLevel === "high") {
    resourceImpactNotes.push("Saturation high → lifecycle freshness pressure");
  }

  if (coherenceSummary.coherenceLevel === "misaligned") {
    driftPropagationPaths.push("coherence misaligned ← upstream lifecycle/priority");
  }
  if (divergenceReport.divergenceSeverity === "high") {
    driftPropagationPaths.push("divergence high ← drift+sync");
  }

  const recommendations: string[] = [
    "Impact propagation은 planning 관계 메타만 표시합니다. actual orchestration 없음.",
    driftPropagationPaths.length > 0 || stalePropagationPaths.length > 0
      ? "전파 경로를 dependency graph와 함께 확인하세요."
      : "전파 경로는 관측 범위에서 낮습니다.",
  ];

  return {
    mode: "runtime_planning_impact_propagation_summary",
    actualRuntimeOrchestrationEnabled: false,
    driftPropagationPaths: [...new Set(driftPropagationPaths)].slice(0, 8),
    stalePropagationPaths: [...new Set(stalePropagationPaths)].slice(0, 8),
    lifecyclePropagationNotes: lifecyclePropagationNotes.slice(0, 6),
    governanceImpactNotes: governanceImpactNotes.slice(0, 6),
    resourceImpactNotes: resourceImpactNotes.slice(0, 6),
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeRuntimePlanningImpactPropagationSummaryForDiagnostic(
  summary: RuntimePlanningImpactPropagationSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    driftPropagationPaths: [...summary.driftPropagationPaths],
    stalePropagationPaths: [...summary.stalePropagationPaths],
    lifecyclePropagationNotes: [...summary.lifecyclePropagationNotes],
    governanceImpactNotes: [...summary.governanceImpactNotes],
    resourceImpactNotes: [...summary.resourceImpactNotes],
    recommendations: [...summary.recommendations],
  };
}
