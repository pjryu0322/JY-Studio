/**
 * H18 — explainability graph·warning origin·explosion risk **planning 보고서** 일괄 산출.
 */

import type { RuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import type { RuntimeSemanticCorePlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { buildRuntimeSemanticExplainabilityGraph } from "./buildRuntimeSemanticExplainabilityGraph";
import { evaluateRuntimeSemanticExplosionRisk } from "./evaluateRuntimeSemanticExplosionRisk";
import { resolveRuntimeSemanticWarningOrigins } from "./resolveRuntimeSemanticWarningOrigins";
import type {
  RuntimeSemanticExplosionRiskSummary,
  RuntimeSemanticExplainabilityGraph,
  RuntimeSemanticWarningOriginSummary,
} from "./runtimeSemanticGraphTypes";

export type RuntimeSemanticGraphPlanningReports = Readonly<{
  semanticExplainabilityGraph: RuntimeSemanticExplainabilityGraph;
  semanticWarningOriginSummary: RuntimeSemanticWarningOriginSummary;
  semanticExplosionRiskSummary: RuntimeSemanticExplosionRiskSummary;
}>;

export function buildRuntimeSemanticGraphPlanningReports(
  reasoningReports: RuntimeReasoningPlanningReports,
  semanticReports: RuntimeSemanticCorePlanningReports
): RuntimeSemanticGraphPlanningReports {
  const semanticExplainabilityGraph = buildRuntimeSemanticExplainabilityGraph(
    reasoningReports,
    semanticReports
  );
  const semanticWarningOriginSummary = resolveRuntimeSemanticWarningOrigins(semanticReports);
  const semanticExplosionRiskSummary = evaluateRuntimeSemanticExplosionRisk(semanticReports);

  return {
    semanticExplainabilityGraph,
    semanticWarningOriginSummary,
    semanticExplosionRiskSummary,
  };
}
