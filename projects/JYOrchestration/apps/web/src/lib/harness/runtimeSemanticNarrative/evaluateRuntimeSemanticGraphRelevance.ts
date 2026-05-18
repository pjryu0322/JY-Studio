/**
 * H18.5 — explainability graph **path relevance ranking**(read-only).
 */

import type { RuntimeSemanticCorePlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticGraphPlanningReports } from "@/lib/harness/runtimeSemanticGraph/buildRuntimeSemanticGraphPlanningReports";
import type {
  RuntimeSemanticGraphRelevanceSummary,
  RuntimeSemanticNarrativeSeverity,
  RuntimeSemanticRootCauseGroup,
} from "./runtimeSemanticNarrativeTypes";

const MAX_RANKED = 6;

function severityForPath(path: string, quality: string): RuntimeSemanticNarrativeSeverity {
  const lower = path.toLowerCase();
  if (lower.includes("warning") || lower.includes("hidden critical") || quality === "over_compressed") {
    return "critical_candidate";
  }
  if (lower.includes("explosion") || lower.includes("escalation") || lower.includes("watch")) {
    return "watch";
  }
  return "info";
}

function scorePath(
  path: string,
  semanticReports: RuntimeSemanticCorePlanningReports,
  rootCauseGroups: readonly RuntimeSemanticRootCauseGroup[]
): number {
  let score = 10;
  const lower = path.toLowerCase();
  if (lower.includes("warning")) score += 40;
  if (lower.includes("hidden")) score += 30;
  if (lower.includes("critical")) score += 25;
  if (lower.includes("escalation") || lower.includes("explosion")) score += 20;
  if (lower.includes("governance")) score += 15;
  if (semanticReports.compressionQualityReport.quality === "over_compressed") score += 15;
  if (semanticReports.hiddenTraceAudit.hiddenCriticalTransitionCount > 0) score += 10;

  for (const g of rootCauseGroups) {
    const chain = g.primaryChain.join(" ").toLowerCase();
    if (lower.includes(g.kind.replace(/_/g, " ")) || lower.includes(chain.slice(0, 12))) {
      score += 12;
    }
  }

  return score;
}

export function evaluateRuntimeSemanticGraphRelevance(
  semanticReports: RuntimeSemanticCorePlanningReports,
  graphReports: RuntimeSemanticGraphPlanningReports,
  rootCauseGroups: readonly RuntimeSemanticRootCauseGroup[]
): RuntimeSemanticGraphRelevanceSummary {
  const quality = semanticReports.compressionQualityReport.quality;
  const paths = graphReports.semanticExplainabilityGraph.causalPaths;
  const seen = new Set<string>();

  const ranked = paths
    .filter((p) => {
      if (seen.has(p)) return false;
      seen.add(p);
      return true;
    })
    .map((path) => ({
      path,
      relevanceScore: scorePath(path, semanticReports, rootCauseGroups),
      severity: severityForPath(path, quality),
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore || a.path.localeCompare(b.path))
    .slice(0, MAX_RANKED);

  const collapsedDuplicates = Math.max(
    0,
    graphReports.semanticWarningOriginSummary.origins.length - rootCauseGroups.length
  );

  const criticalPath = ranked[0]?.path ?? paths[0] ?? "—";
  const warningCollapseSummaryKo =
    collapsedDuplicates > 0
      ? `동일 root cause로 ${collapsedDuplicates}건 warning·path가 접혔습니다.`
      : "중복 warning path 없음(관측 범위).";

  return {
    mode: "runtime_semantic_graph_relevance_summary",
    actualRuntimeOrchestrationEnabled: false,
    rankedPaths: ranked,
    criticalPath,
    warningCollapseSummaryKo,
    recommendations: [
      "Graph relevance는 read-only ranking metadata입니다. actual orchestration 없음.",
      ranked.length > 0
        ? "overlay에서는 critical path 1개와 상위 narrative만 우선 표시하세요."
        : "현재 causal path relevance가 낮습니다.",
    ].slice(0, 6),
  };
}

export function serializeRuntimeSemanticGraphRelevanceSummaryForDiagnostic(
  summary: RuntimeSemanticGraphRelevanceSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    rankedPaths: summary.rankedPaths.map((r) => ({ ...r })),
    criticalPath: summary.criticalPath,
    warningCollapseSummaryKo: summary.warningCollapseSummaryKo,
    recommendations: [...summary.recommendations],
  };
}
