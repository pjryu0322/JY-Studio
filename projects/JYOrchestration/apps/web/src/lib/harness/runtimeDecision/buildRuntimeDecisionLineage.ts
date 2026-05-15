/**
 * H19.5 — warning·semantic·governance·routing **decision lineage**(read-only).
 */

import type { RuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import type { RuntimeSemanticPlanningReportsBeforeDecision } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeDecisionEdge,
  RuntimeDecisionLineage,
  RuntimeDecisionNode,
  RuntimeDecisionReason,
} from "./runtimeDecisionTypes";

const MAX_NODES = 10;
const MAX_EDGES = 12;
const MAX_PATHS = 5;

function addNode(
  nodes: RuntimeDecisionNode[],
  seen: Set<string>,
  id: string,
  type: RuntimeDecisionNode["type"],
  labelKo: string
): void {
  if (seen.has(id) || nodes.length >= MAX_NODES) return;
  seen.add(id);
  nodes.push({ id, type, labelKo });
}

function addEdge(
  edges: RuntimeDecisionEdge[],
  seen: Set<string>,
  from: string,
  to: string,
  relation: RuntimeDecisionEdge["relation"],
  labelKo: string
): void {
  const key = `${from}|${to}|${relation}`;
  if (seen.has(key) || edges.length >= MAX_EDGES) return;
  seen.add(key);
  edges.push({ from, to, relation, labelKo });
}

export function buildRuntimeDecisionLineage(
  reasoningReports: RuntimeReasoningPlanningReports,
  semanticReports: RuntimeSemanticPlanningReportsBeforeDecision
): RuntimeDecisionLineage {
  const nodes: RuntimeDecisionNode[] = [];
  const edges: RuntimeDecisionEdge[] = [];
  const nodeSeen = new Set<string>();
  const edgeSeen = new Set<string>();
  const lineagePaths: string[] = [];

  addNode(nodes, nodeSeen, "warn-root", "warning", "Planning warnings");
  addNode(nodes, nodeSeen, "semantic-root", "semantic", "Semantic meaning");
  addNode(nodes, nodeSeen, "gov-root", "governance", "Governance impact");
  addNode(nodes, nodeSeen, "route-root", "routing", "Routing implication");
  addNode(nodes, nodeSeen, "rec-root", "recommendation", "Orchestration recommendation");

  addEdge(edges, edgeSeen, "warn-root", "semantic-root", "causes", "warning → semantic meaning");
  addEdge(edges, edgeSeen, "semantic-root", "gov-root", "propagates", "semantic → governance");
  addEdge(edges, edgeSeen, "gov-root", "route-root", "implies", "governance → routing");
  addEdge(edges, edgeSeen, "route-root", "rec-root", "recommends", "routing → recommendation");

  if (semanticReports.compressionQualityReport.quality !== "safe") {
    lineagePaths.push(
      "warning → semantic compression → governance trace → routing implication → orchestration recommendation"
    );
  }
  if (semanticReports.semanticExplosionRiskSummary.explosionRisk !== "low") {
    lineagePaths.push(
      "semantic explosion → vocabulary normalization → governance review recommendation"
    );
  }
  if (reasoningReports.unifiedReasoningChain.criticalTransitions.length > 0) {
    lineagePaths.push(
      "reasoning critical transition → semantic graph → decision lineage → stable routing metadata"
    );
  }
  if (lineagePaths.length === 0) {
    lineagePaths.push(
      "stable planning path → semantic vocabulary → read-only orchestration observability"
    );
  }

  const primaryReason: RuntimeDecisionReason | null =
    semanticReports.compressionQualityReport.quality !== "safe"
      ? {
          code: "compression_quality_decision",
          severity: "watch",
          messageKo: "압축 품질 신호가 decision lineage 상위에 반영되었습니다.",
        }
      : semanticReports.semanticPriorityVocabulary.priorities[0]?.meaningLevel === "critical"
        ? {
            code: "priority_critical_decision",
            severity: "critical_candidate",
            messageKo: `${semanticReports.semanticPriorityVocabulary.topPriorityLabelKo} 우선순위가 lineage root입니다.`,
          }
        : null;

  return {
    mode: "runtime_decision_lineage",
    actualRuntimeOrchestrationEnabled: false,
    nodes: nodes.slice(0, MAX_NODES),
    edges: edges.slice(0, MAX_EDGES),
    lineagePaths: [...new Set(lineagePaths)].slice(0, MAX_PATHS),
    primaryReason,
    recommendations: [
      "Decision lineage는 read-only planning metadata입니다. actual execution 없음.",
      lineagePaths.length > 3
        ? "compact UI에서는 primary lineage path만 표시하세요."
        : "lineage는 deterministic ordering으로 안정화됩니다.",
    ].slice(0, 6),
  };
}

export function serializeRuntimeDecisionLineageForDiagnostic(
  lineage: RuntimeDecisionLineage
): Readonly<Record<string, unknown>> {
  return {
    mode: lineage.mode,
    actualRuntimeOrchestrationEnabled: lineage.actualRuntimeOrchestrationEnabled,
    nodes: lineage.nodes.map((n) => ({ ...n })),
    edges: lineage.edges.map((e) => ({ ...e })),
    lineagePaths: [...lineage.lineagePaths],
    primaryReason: lineage.primaryReason ? { ...lineage.primaryReason } : null,
    recommendations: [...lineage.recommendations],
  };
}
