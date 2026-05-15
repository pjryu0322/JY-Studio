/**
 * H19 — vocabulary·normalized labels·priority **planning 보고서** 일괄 산출.
 */

import type { RuntimeSemanticCorePlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticGraphPlanningReports } from "@/lib/harness/runtimeSemanticGraph/buildRuntimeSemanticGraphPlanningReports";
import type { RuntimeSemanticNarrativePlanningReports } from "@/lib/harness/runtimeSemanticNarrative/runtimeSemanticNarrativeTypes";
import { buildRuntimeSemanticVocabularyDictionary } from "./buildRuntimeSemanticVocabularyDictionary";
import { buildRuntimeSemanticPriorityVocabulary } from "./buildRuntimeSemanticPriorityVocabulary";
import type { RuntimeSemanticVocabularyPlanningReports } from "./runtimeSemanticVocabularyTypes";

export type { RuntimeSemanticVocabularyPlanningReports } from "./runtimeSemanticVocabularyTypes";

export function buildRuntimeSemanticVocabularyPlanningReports(
  core: RuntimeSemanticCorePlanningReports,
  graph: RuntimeSemanticGraphPlanningReports,
  narrative: RuntimeSemanticNarrativePlanningReports
): RuntimeSemanticVocabularyPlanningReports {
  const semanticVocabularySummary = buildRuntimeSemanticVocabularyDictionary(core, graph, narrative);
  const semanticPriorityVocabulary = buildRuntimeSemanticPriorityVocabulary(core, graph, narrative);

  return {
    semanticVocabularySummary,
    semanticNormalizedLabels: semanticVocabularySummary.normalizedLabels,
    semanticPriorityVocabulary,
  };
}
