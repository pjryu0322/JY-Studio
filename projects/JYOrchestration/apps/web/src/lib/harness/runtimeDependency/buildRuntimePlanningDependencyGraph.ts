/**
 * H15 — planning **dependency graph** 구성(read-only; normalized context 재사용).
 */

import type { NormalizedRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/runtimePlanningConsolidationTypes";
import type {
  RuntimePlanningDependencyGraph,
  RuntimePlanningGraphEdge,
  RuntimePlanningGraphNode,
  RuntimePlanningGraphNodeStatus,
} from "./runtimeDependencyTypes";

const CHAIN_GOVERNANCE_TO_COHERENCE =
  "governance → stability → priority → escalation → lifecycle → coherence";

function node(
  id: string,
  kind: RuntimePlanningGraphNode["kind"],
  labelKo: string,
  status: RuntimePlanningGraphNodeStatus
): RuntimePlanningGraphNode {
  return { id, kind, labelKo, status };
}

export function buildRuntimePlanningDependencyGraph(
  ctx: NormalizedRuntimePlanningContext
): RuntimePlanningDependencyGraph {
  const { governanceCtx, stabilityReports, priorityReports, lifecycleReports, coherenceReports } = ctx;
  const { governance } = governanceCtx;
  const stab = stabilityReports.stabilitySummary.stabilityLevel;
  const esc = priorityReports.escalationSummary.escalationLevel;
  const fresh = lifecycleReports.freshnessSummary.freshnessLevel;
  const coh = coherenceReports.coherenceSummary.coherenceLevel;

  const govStatus: RuntimePlanningGraphNodeStatus =
    governance.governanceRisk === "high"
      ? "degraded"
      : governance.governanceRisk === "medium"
        ? "watch"
        : "healthy";
  const stabStatus: RuntimePlanningGraphNodeStatus =
    stab === "unstable" ? "degraded" : stab === "watch" || stab === "elevated" ? "watch" : "healthy";
  const priStatus: RuntimePlanningGraphNodeStatus =
    priorityReports.bottleneckSummary.overallPlanningPriority === "critical" ? "degraded" : "healthy";
  const escStatus: RuntimePlanningGraphNodeStatus =
    esc === "critical" || esc === "escalated" ? "degraded" : esc === "watch" ? "watch" : "healthy";
  const lifeStatus: RuntimePlanningGraphNodeStatus =
    fresh === "stale" ? "degraded" : fresh === "aging" ? "watch" : "healthy";
  const cohStatus: RuntimePlanningGraphNodeStatus =
    coh === "misaligned" ? "degraded" : coh === "partial" ? "watch" : "healthy";

  const nodes: RuntimePlanningGraphNode[] = [
    node("governance", "governance", "거버넌스", govStatus),
    node("stability", "stability", "Stability", stabStatus),
    node("priority", "priority", "Priority", priStatus),
    node("escalation", "escalation", "Escalation", escStatus),
    node("lifecycle", "lifecycle", "Lifecycle", lifeStatus),
    node("coherence", "coherence", "Coherence", cohStatus),
    node("resource", "resource", "Resource", stabilityReports.overlayOverload.overlayOverloadRisk === "high" ? "watch" : "healthy"),
    node(
      "explainability",
      "explainability",
      "Explainability",
      stabilityReports.stabilitySummary.riskFactors.some((r) => r.includes("explainability")) ? "watch" : "healthy"
    ),
    node(
      "review_security",
      "review_security",
      "Review/Security",
      governance.operatorReviewReadiness === "not_ready" ? "watch" : "healthy"
    ),
  ];

  const edges: RuntimePlanningGraphEdge[] = [
    { from: "governance", to: "stability", relationKo: "거버넌스 조건 → stability planning" },
    { from: "stability", to: "priority", relationKo: "stability → priority ordering" },
    { from: "priority", to: "escalation", relationKo: "priority → escalation" },
    { from: "escalation", to: "lifecycle", relationKo: "escalation → lifecycle freshness" },
    { from: "lifecycle", to: "coherence", relationKo: "lifecycle → coherence alignment" },
    { from: "resource", to: "stability", relationKo: "resource pressure → stability" },
    { from: "explainability", to: "priority", relationKo: "explainability → priority 신뢰" },
    { from: "review_security", to: "governance", relationKo: "review/security → governance" },
    { from: "governance", to: "lifecycle", relationKo: "governance → lifecycle invalidation" },
  ];

  const criticalDependencies = [
    ...priorityReports.dependencyReport.criticalDependencies,
    ...stabilityReports.stabilitySummary.criticalDependencies,
  ].slice(0, 10);

  const isolatedNodes = nodes.filter((n) => n.status === "isolated").map((n) => n.id);

  const dependencyChains = [
    CHAIN_GOVERNANCE_TO_COHERENCE,
    ...priorityReports.dependencyReport.dependencyCycles.map((c) => `cycle:${c}`),
  ].slice(0, 6);

  return {
    mode: "runtime_planning_dependency_graph",
    actualRuntimeOrchestrationEnabled: false,
    nodes,
    edges,
    criticalDependencies: [...new Set(criticalDependencies)].slice(0, 8),
    isolatedNodes,
    dependencyChains,
  };
}

export function serializeRuntimePlanningDependencyGraphForDiagnostic(
  graph: RuntimePlanningDependencyGraph
): Readonly<Record<string, unknown>> {
  return {
    mode: graph.mode,
    actualRuntimeOrchestrationEnabled: graph.actualRuntimeOrchestrationEnabled,
    nodes: graph.nodes.map((n) => ({ ...n })),
    edges: graph.edges.map((e) => ({ ...e })),
    criticalDependencies: [...graph.criticalDependencies],
    isolatedNodes: [...graph.isolatedNodes],
    dependencyChains: [...graph.dependencyChains],
  };
}
