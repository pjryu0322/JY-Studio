/**
 * H18 — reasoning·semantic·quality 관계 **explainability graph**(read-only).
 */

import type { RuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import type { RuntimeSemanticCorePlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeSemanticExplainabilityGraph,
  RuntimeSemanticGraphEdge,
  RuntimeSemanticGraphNode,
} from "./runtimeSemanticGraphTypes";

const MAX_NODES = 12;
const MAX_EDGES = 14;
const MAX_PATHS = 6;

function addNode(
  nodes: RuntimeSemanticGraphNode[],
  seen: Set<string>,
  id: string,
  type: RuntimeSemanticGraphNode["type"],
  labelKo: string
): void {
  if (seen.has(id) || nodes.length >= MAX_NODES) return;
  seen.add(id);
  nodes.push({ id, type, labelKo });
}

function addEdge(
  edges: RuntimeSemanticGraphEdge[],
  seen: Set<string>,
  from: string,
  to: string,
  relation: RuntimeSemanticGraphEdge["relation"],
  labelKo: string
): void {
  const key = `${from}|${to}|${relation}`;
  if (seen.has(key) || edges.length >= MAX_EDGES) return;
  seen.add(key);
  edges.push({ from, to, relation, labelKo });
}

export function buildRuntimeSemanticExplainabilityGraph(
  reasoningReports: RuntimeReasoningPlanningReports,
  semanticReports: RuntimeSemanticCorePlanningReports
): RuntimeSemanticExplainabilityGraph {
  const nodes: RuntimeSemanticGraphNode[] = [];
  const edges: RuntimeSemanticGraphEdge[] = [];
  const nodeSeen = new Set<string>();
  const edgeSeen = new Set<string>();

  addNode(nodes, nodeSeen, "reasoning-root", "reasoning", "Planning reasoning chain");
  addNode(nodes, nodeSeen, "trace-root", "traceability", "Traceability layer");
  addNode(nodes, nodeSeen, "dep-root", "dependency", "Dependency planning");
  addNode(nodes, nodeSeen, "prop-root", "propagation", "Impact propagation");
  addNode(nodes, nodeSeen, "crit-root", "criticality", "Criticality signals");

  for (const g of semanticReports.semanticGroupsSummary.groups.slice(0, 4)) {
    const id = `group-${g.kind}`;
    addNode(nodes, nodeSeen, id, "semantic_group", g.labelKo);
    addEdge(edges, edgeSeen, "reasoning-root", id, "explains", "reasoning → semantic group");
  }

  addNode(nodes, nodeSeen, "compress", "semantic_group", "Semantic compression");
  addEdge(edges, edgeSeen, "prop-root", "compress", "compresses", "propagation → compression");

  if (semanticReports.hiddenTraceAudit.hiddenTraceCount > 0) {
    addNode(nodes, nodeSeen, "hidden", "warning", "Hidden trace audit");
    addEdge(edges, edgeSeen, "compress", "hidden", "hides", "compression → hidden trace");
  }

  const quality = semanticReports.compressionQualityReport.quality;
  if (quality !== "safe") {
    addNode(nodes, nodeSeen, "quality-warn", "quality", `Compression quality: ${quality}`);
    addEdge(edges, edgeSeen, "hidden", "quality-warn", "warns", "hidden → quality warning");
  }

  addEdge(edges, edgeSeen, "dep-root", "prop-root", "propagates", "dependency → propagation");
  addEdge(edges, edgeSeen, "prop-root", "crit-root", "causes", "propagation → criticality");
  addEdge(edges, edgeSeen, "trace-root", "reasoning-root", "explains", "traceability → reasoning");

  const causalPaths: string[] = [];
  if (semanticReports.compressionQualityReport.quality === "over_compressed") {
    causalPaths.push(
      "dependency conflict → propagation escalation → semantic compression → hidden governance trace → quality warning"
    );
  }
  if (reasoningReports.unifiedReasoningChain.criticalTransitions.length > 0) {
    causalPaths.push(
      "reasoning critical transition → semantic group → compressed trace → quality audit"
    );
  }
  if (semanticReports.hiddenTraceAudit.hiddenCriticalTransitionCount > 0) {
    causalPaths.push(
      "propagation chain → semantic compression → hidden critical transition → quality watch"
    );
  }
  if (semanticReports.semanticRedundancySummary.reasoningExplosionRisk !== "low") {
    causalPaths.push("reasoning explosion risk → semantic grouping → redundancy warning");
  }
  if (causalPaths.length === 0) {
    causalPaths.push(
      "dependency planning → propagation → semantic compression → stable quality (metadata)"
    );
  }

  const recommendations: string[] = [
    "Explainability graph는 read-only planning 메타입니다. actual execution 없음.",
    causalPaths.length > 4
      ? "compact UI에서는 warning causal path를 우선 표시하세요."
      : "causal path는 overlay-safe 요약 수준만 제공합니다.",
  ];

  return {
    mode: "runtime_semantic_explainability_graph",
    actualRuntimeOrchestrationEnabled: false,
    nodes: nodes.slice(0, MAX_NODES),
    edges: edges.slice(0, MAX_EDGES),
    causalPaths: [...new Set(causalPaths)].slice(0, MAX_PATHS),
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeRuntimeSemanticExplainabilityGraphForDiagnostic(
  graph: RuntimeSemanticExplainabilityGraph
): Readonly<Record<string, unknown>> {
  return {
    mode: graph.mode,
    actualRuntimeOrchestrationEnabled: graph.actualRuntimeOrchestrationEnabled,
    nodes: graph.nodes.map((n) => ({ ...n })),
    edges: graph.edges.map((e) => ({ ...e })),
    causalPaths: [...graph.causalPaths],
    recommendations: [...graph.recommendations],
  };
}
