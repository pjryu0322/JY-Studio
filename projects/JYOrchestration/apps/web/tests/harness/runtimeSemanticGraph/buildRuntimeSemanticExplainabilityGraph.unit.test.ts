import { describe, expect, it } from "vitest";

import { buildRuntimeSemanticExplainabilityGraph } from "@/lib/harness/runtimeSemanticGraph/buildRuntimeSemanticExplainabilityGraph";
import { buildSemanticPlanningTestFixtures } from "../runtimeSemantic/semanticTestFixtures";

describe("H18 buildRuntimeSemanticExplainabilityGraph", () => {
  it("builds capped read-only graph with causal paths", () => {
    const { reasoning, semantic } = buildSemanticPlanningTestFixtures();
    const graph = buildRuntimeSemanticExplainabilityGraph(reasoning, semantic);
    expect(graph.mode).toBe("runtime_semantic_explainability_graph");
    expect(graph.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.nodes.length).toBeLessThanOrEqual(12);
    expect(graph.edges.length).toBeLessThanOrEqual(14);
    expect(graph.causalPaths.length).toBeLessThanOrEqual(6);
  });
});
