/**
 * H19.5 — decision lineage·snapshot·recommendation·coherence **planning 보고서** 일괄 산출.
 */

import type { RuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import type { RuntimeSemanticPlanningReportsBeforeDecision } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { buildRuntimeDecisionLineage } from "./buildRuntimeDecisionLineage";
import { buildRuntimeDecisionSnapshot } from "./buildRuntimeDecisionSnapshot";
import { buildRuntimeRecommendationSummary } from "./buildRuntimeRecommendationSummary";
import { evaluateRuntimeDecisionCoherence } from "./evaluateRuntimeDecisionCoherence";
import type { RuntimeDecisionPlanningReports } from "./runtimeDecisionTypes";

export type { RuntimeDecisionPlanningReports } from "./runtimeDecisionTypes";

export function buildRuntimeDecisionPlanningReports(
  reasoningReports: RuntimeReasoningPlanningReports,
  semanticReports: RuntimeSemanticPlanningReportsBeforeDecision
): RuntimeDecisionPlanningReports {
  const runtimeDecisionLineage = buildRuntimeDecisionLineage(reasoningReports, semanticReports);
  const runtimeRecommendationSummary = buildRuntimeRecommendationSummary(semanticReports);
  const runtimeDecisionCoherence = evaluateRuntimeDecisionCoherence(reasoningReports, semanticReports);
  const runtimeDecisionSnapshot = buildRuntimeDecisionSnapshot(
    semanticReports,
    runtimeDecisionLineage,
    runtimeRecommendationSummary,
    runtimeDecisionCoherence
  );

  return {
    runtimeDecisionLineage,
    runtimeDecisionSnapshot,
    runtimeRecommendationSummary,
    runtimeDecisionCoherence,
  };
}
