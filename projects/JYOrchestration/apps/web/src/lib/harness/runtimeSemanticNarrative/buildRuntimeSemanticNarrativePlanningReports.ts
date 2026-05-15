/**
 * H18.5 — narrative·root-cause·graph relevance **planning 보고서** 일괄 산출.
 */

import type { RuntimeSemanticCorePlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticGraphPlanningReports } from "@/lib/harness/runtimeSemanticGraph/buildRuntimeSemanticGraphPlanningReports";
import { buildRuntimeSemanticNarratives } from "./buildRuntimeSemanticNarratives";
import { consolidateRuntimeSemanticRootCauses } from "./consolidateRuntimeSemanticRootCauses";
import { evaluateRuntimeSemanticGraphRelevance } from "./evaluateRuntimeSemanticGraphRelevance";
import type { RuntimeSemanticNarrativePlanningReports } from "./runtimeSemanticNarrativeTypes";

export type { RuntimeSemanticNarrativePlanningReports } from "./runtimeSemanticNarrativeTypes";

export function buildRuntimeSemanticNarrativePlanningReports(
  semanticReports: RuntimeSemanticCorePlanningReports,
  graphReports: RuntimeSemanticGraphPlanningReports
): RuntimeSemanticNarrativePlanningReports {
  const semanticRootCauseGroups = consolidateRuntimeSemanticRootCauses(semanticReports, graphReports);
  const semanticGraphRelevanceSummary = evaluateRuntimeSemanticGraphRelevance(
    semanticReports,
    graphReports,
    semanticRootCauseGroups
  );
  const semanticNarrativeSummary = buildRuntimeSemanticNarratives(
    semanticRootCauseGroups,
    semanticGraphRelevanceSummary
  );

  return {
    semanticNarrativeSummary,
    semanticRootCauseGroups,
    semanticGraphRelevanceSummary,
  };
}
