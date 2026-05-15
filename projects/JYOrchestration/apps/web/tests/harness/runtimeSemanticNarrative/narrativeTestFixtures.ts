import { buildRuntimeSemanticGraphPlanningReports } from "@/lib/harness/runtimeSemanticGraph/buildRuntimeSemanticGraphPlanningReports";
import type { RuntimeSemanticGraphPlanningReports } from "@/lib/harness/runtimeSemanticGraph/buildRuntimeSemanticGraphPlanningReports";
import type { RuntimeSemanticCorePlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import { buildSemanticPlanningTestFixtures } from "../runtimeSemantic/semanticTestFixtures";

export function buildSemanticNarrativePlanningTestFixtures(): Readonly<{
  reasoning: RuntimeReasoningPlanningReports;
  semantic: RuntimeSemanticCorePlanningReports;
  graph: RuntimeSemanticGraphPlanningReports;
}> {
  const { reasoning, semantic } = buildSemanticPlanningTestFixtures();
  const graph = buildRuntimeSemanticGraphPlanningReports(reasoning, semantic);
  return { reasoning, semantic, graph };
}
