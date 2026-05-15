/**
 * H15 — planning **dependency conflict** 평가(read-only).
 */

import type { NormalizedRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/runtimePlanningConsolidationTypes";
import type {
  RuntimePlanningDependencyConflictSeverity,
  RuntimePlanningDependencyConflictSummary,
} from "./runtimeDependencyTypes";

export function evaluateRuntimePlanningDependencyConflicts(
  ctx: NormalizedRuntimePlanningContext
): RuntimePlanningDependencyConflictSummary {
  const circularDependencies: string[] = [...ctx.priorityReports.dependencyReport.dependencyCycles];
  const conflictingLifecycleSignals: string[] = [];
  const duplicatedDependencies: string[] = [];
  const staleDependencyChains: string[] = [];
  const escalationConflicts: string[] = [];
  let severity: RuntimePlanningDependencyConflictSeverity = "low";

  const bump = (next: RuntimePlanningDependencyConflictSeverity) => {
    const order: RuntimePlanningDependencyConflictSeverity[] = ["low", "medium", "high"];
    if (order.indexOf(next) > order.indexOf(severity)) severity = next;
  };

  if (circularDependencies.length > 0) {
    bump("high");
  }

  const { freshnessSummary, invalidationSummary } = ctx.lifecycleReports;
  const { coherenceSummary, synchronizationSummary } = ctx.coherenceReports;
  const esc = ctx.priorityReports.escalationSummary;

  if (
    freshnessSummary.freshnessLevel === "fresh" &&
    coherenceSummary.coherenceLevel === "misaligned"
  ) {
    conflictingLifecycleSignals.push("fresh lifecycle vs misaligned coherence");
    bump("medium");
  }
  if (
    invalidationSummary.lifecycleState === "invalidated" &&
    synchronizationSummary.synchronizationState === "synchronized"
  ) {
    conflictingLifecycleSignals.push("invalidated lifecycle vs synchronized meta");
    bump("medium");
  }

  const critSet = new Set(ctx.priorityReports.dependencyReport.criticalDependencies);
  for (const c of ctx.stabilityReports.stabilitySummary.criticalDependencies) {
    if (critSet.has(c)) duplicatedDependencies.push(c);
  }
  if (duplicatedDependencies.length > 0) {
    duplicatedDependencies.push("critical dependency duplicated across stability/priority");
    bump("medium");
  }

  for (const dep of invalidationSummary.staleDependencies) {
    staleDependencyChains.push(dep);
  }
  if (staleDependencyChains.length >= 2) bump("medium");

  if (esc.escalationLevel === "critical" && esc.operatorAttentionRequired === false) {
    escalationConflicts.push("critical escalation without operator attention flag");
    bump("medium");
  }
  if (esc.escalationLevel === "none" && esc.criticalAreas.length > 0) {
    escalationConflicts.push("critical areas present with low escalation level");
    bump("medium");
  }

  const severityOrder: RuntimePlanningDependencyConflictSeverity[] = ["low", "medium", "high"];
  const recommendations: string[] = [
    "Dependency conflict는 planning graph 진단만 제공합니다. enforcement·routing 없음.",
    severityOrder.indexOf(severity) >= severityOrder.indexOf("high")
      ? "순환·충돌 dependency를 graph에서 먼저 해소(메타)하세요."
      : "주기적으로 dependency chains를 unified summary와 교차 확인하세요.",
  ];

  return {
    mode: "runtime_planning_dependency_conflict_summary",
    actualRuntimeOrchestrationEnabled: false,
    severity,
    circularDependencies: circularDependencies.slice(0, 8),
    conflictingLifecycleSignals: conflictingLifecycleSignals.slice(0, 8),
    duplicatedDependencies: [...new Set(duplicatedDependencies)].slice(0, 8),
    staleDependencyChains: staleDependencyChains.slice(0, 8),
    escalationConflicts: escalationConflicts.slice(0, 8),
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeRuntimePlanningDependencyConflictSummaryForDiagnostic(
  summary: RuntimePlanningDependencyConflictSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    severity: summary.severity,
    circularDependencies: [...summary.circularDependencies],
    conflictingLifecycleSignals: [...summary.conflictingLifecycleSignals],
    duplicatedDependencies: [...summary.duplicatedDependencies],
    staleDependencyChains: [...summary.staleDependencyChains],
    escalationConflicts: [...summary.escalationConflicts],
    recommendations: [...summary.recommendations],
  };
}
