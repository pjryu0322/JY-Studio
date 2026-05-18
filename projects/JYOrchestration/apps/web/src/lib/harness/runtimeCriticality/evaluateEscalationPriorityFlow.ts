/**
 * H15.5 — **escalation priority flow** 평가(read-only).
 */

import type { NormalizedRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/runtimePlanningConsolidationTypes";
import type { RuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import type { RuntimeEscalationPriorityFlowSummary } from "./runtimeCriticalityTypes";

export function evaluateEscalationPriorityFlow(
  ctx: NormalizedRuntimePlanningContext,
  dependencyReports: RuntimeDependencyPlanningReports
): RuntimeEscalationPriorityFlowSummary {
  const staleEscalationPriorities: string[] = [];
  const governanceEscalationPriorities: string[] = [];
  const lifecycleEscalationChains: string[] = [];
  const criticalDependencyEscalations: string[] = [];

  const { freshnessSummary, invalidationSummary } = ctx.lifecycleReports;
  const esc = ctx.priorityReports.escalationSummary;
  const { governance } = ctx.governanceCtx;

  if (freshnessSummary.freshnessLevel === "stale" || freshnessSummary.freshnessLevel === "aging") {
    staleEscalationPriorities.push(`stale freshness:${freshnessSummary.freshnessLevel} → watch escalation`);
  }
  for (const dep of invalidationSummary.staleDependencies) {
    staleEscalationPriorities.push(`stale dep:${dep}`);
  }

  if (governance.governanceRisk === "high") {
    governanceEscalationPriorities.push("governance high → critical escalation path");
  } else if (governance.governanceRisk === "medium") {
    governanceEscalationPriorities.push("governance medium → elevated escalation path");
  }
  if (governance.operatorReviewReadiness === "not_ready") {
    governanceEscalationPriorities.push("operator review not ready → escalation hold (meta)");
  }

  lifecycleEscalationChains.push(
    `governance → stability → priority → escalation(${esc.escalationLevel}) → lifecycle(${invalidationSummary.lifecycleState})`
  );
  if (ctx.coherenceReports.coherenceSummary.coherenceLevel === "misaligned") {
    lifecycleEscalationChains.push("lifecycle → coherence misaligned escalation chain");
  }

  for (const dep of dependencyReports.dependencyGraph.criticalDependencies) {
    criticalDependencyEscalations.push(`${dep} → escalation attention`);
  }
  for (const cycle of dependencyReports.dependencyConflictSummary.circularDependencies) {
    criticalDependencyEscalations.push(`cycle:${cycle}`);
  }

  const recommendations: string[] = [
    "Escalation priority flow는 planning 메타만 제공합니다. actual enforcement 없음.",
    esc.operatorAttentionRequired
      ? "operator attention 플래그와 escalation chain을 함께 확인하세요."
      : "escalation flow는 관측 범위에서 안정적입니다.",
  ];

  return {
    mode: "runtime_escalation_priority_flow_summary",
    actualRuntimeOrchestrationEnabled: false,
    staleEscalationPriorities: [...new Set(staleEscalationPriorities)].slice(0, 8),
    governanceEscalationPriorities: [...new Set(governanceEscalationPriorities)].slice(0, 8),
    lifecycleEscalationChains: [...new Set(lifecycleEscalationChains)].slice(0, 6),
    criticalDependencyEscalations: [...new Set(criticalDependencyEscalations)].slice(0, 8),
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeRuntimeEscalationPriorityFlowSummaryForDiagnostic(
  summary: RuntimeEscalationPriorityFlowSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    staleEscalationPriorities: [...summary.staleEscalationPriorities],
    governanceEscalationPriorities: [...summary.governanceEscalationPriorities],
    lifecycleEscalationChains: [...summary.lifecycleEscalationChains],
    criticalDependencyEscalations: [...summary.criticalDependencyEscalations],
    recommendations: [...summary.recommendations],
  };
}
