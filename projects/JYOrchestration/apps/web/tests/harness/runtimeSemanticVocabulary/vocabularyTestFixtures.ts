import { buildRuntimeSemanticGraphPlanningReports } from "@/lib/harness/runtimeSemanticGraph/buildRuntimeSemanticGraphPlanningReports";
import { buildRuntimeSemanticNarrativePlanningReports } from "@/lib/harness/runtimeSemanticNarrative/buildRuntimeSemanticNarrativePlanningReports";
import { buildSemanticPlanningTestFixtures } from "../runtimeSemantic/semanticTestFixtures";

export function buildSemanticVocabularyPlanningTestFixtures() {
  const { reasoning, semantic } = buildSemanticPlanningTestFixtures();
  const graph = buildRuntimeSemanticGraphPlanningReports(reasoning, semantic);
  const narrative = buildRuntimeSemanticNarrativePlanningReports(semantic, graph);
  return { reasoning, semantic, graph, narrative };
}
