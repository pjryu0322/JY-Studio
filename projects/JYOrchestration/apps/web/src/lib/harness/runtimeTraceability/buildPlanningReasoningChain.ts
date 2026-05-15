/**
 * H16 — planning **reasoning chain** 구성(read-only; H15/H15.5 reports 재사용).
 */

import type { NormalizedRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/runtimePlanningConsolidationTypes";
import type { RuntimeCriticalityPlanningReports } from "@/lib/harness/runtimeCriticality/buildRuntimeCriticalityPlanningReports";
import type { RuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import type { RuntimePlanningReasoningChain, RuntimePlanningReasoningStep } from "./runtimeTraceabilityTypes";

function step(
  id: string,
  kind: RuntimePlanningReasoningStep["kind"],
  labelKo: string,
  explanationKo: string
): RuntimePlanningReasoningStep {
  return { id, kind, labelKo, explanationKo };
}

export function buildPlanningReasoningChain(
  ctx: NormalizedRuntimePlanningContext,
  dependencyReports: RuntimeDependencyPlanningReports,
  criticalityReports: RuntimeCriticalityPlanningReports
): RuntimePlanningReasoningChain {
  const { dependencyGraph, impactPropagationSummary } = dependencyReports;
  const { criticalitySummary, priorityPropagationSummary, escalationPriorityFlowSummary } =
    criticalityReports;
  const { governance } = ctx.governanceCtx;
  const { freshnessSummary, invalidationSummary } = ctx.lifecycleReports;
  const esc = ctx.priorityReports.escalationSummary;

  const reasoningSteps: RuntimePlanningReasoningStep[] = [
    step(
      "gov",
      "governance",
      "거버넌스",
      `governance risk ${governance.governanceRisk} — operator review ${governance.operatorReviewReadiness}`
    ),
    step(
      "life",
      "lifecycle",
      "Lifecycle",
      `freshness ${freshnessSummary.freshnessLevel}, lifecycle ${invalidationSummary.lifecycleState}`
    ),
    ...dependencyGraph.nodes.map((n) =>
      step(
        `dep-${n.id}`,
        "dependency",
        n.labelKo,
        `node ${n.id} status ${n.status} — planning graph only`
      )
    ),
    step(
      "esc",
      "escalation",
      "Escalation",
      `level ${esc.escalationLevel}, operator attention ${esc.operatorAttentionRequired}`
    ),
    step(
      "crit",
      "criticality",
      "Criticality",
      `score ${criticalitySummary.criticalityScore}, critical nodes ${criticalitySummary.criticalNodes.length}`
    ),
    step(
      "coh",
      "coherence",
      "Coherence",
      `coherence ${ctx.coherenceReports.coherenceSummary.coherenceLevel}`
    ),
  ];

  const nodes = dependencyGraph.nodes.map((n) => `${n.labelKo} (${n.id})`);
  const dependencies = dependencyGraph.edges.map((e) => `${e.from} → ${e.to}`);
  const criticalTransitions = [
    ...criticalitySummary.criticalNodes.slice(0, 4),
    ...escalationPriorityFlowSummary.lifecycleEscalationChains.slice(0, 2),
  ];
  const explanations = [
    "Planning reasoning chain은 메타 진단만 제공합니다. actual orchestration 없음.",
    ...impactPropagationSummary.driftPropagationPaths.slice(0, 2),
    ...priorityPropagationSummary.dependencyPriorityPaths.slice(0, 2),
  ];

  return {
    mode: "runtime_planning_reasoning_chain",
    actualRuntimeOrchestrationEnabled: false,
    nodes: [...new Set(nodes)].slice(0, 12),
    reasoningSteps: reasoningSteps.slice(0, 14),
    dependencies: [...new Set(dependencies)].slice(0, 10),
    criticalTransitions: [...new Set(criticalTransitions)].slice(0, 8),
    explanations: [...new Set(explanations)].slice(0, 8),
  };
}

export function serializeRuntimePlanningReasoningChainForDiagnostic(
  chain: RuntimePlanningReasoningChain
): Readonly<Record<string, unknown>> {
  return {
    mode: chain.mode,
    actualRuntimeOrchestrationEnabled: chain.actualRuntimeOrchestrationEnabled,
    nodes: [...chain.nodes],
    reasoningSteps: chain.reasoningSteps.map((s) => ({ ...s })),
    dependencies: [...chain.dependencies],
    criticalTransitions: [...chain.criticalTransitions],
    explanations: [...chain.explanations],
  };
}
