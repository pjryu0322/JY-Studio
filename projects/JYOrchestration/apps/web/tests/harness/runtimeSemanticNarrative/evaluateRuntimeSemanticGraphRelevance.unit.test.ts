import { describe, expect, it } from "vitest";

import { evaluateRuntimeSemanticGraphRelevance } from "@/lib/harness/runtimeSemanticNarrative/evaluateRuntimeSemanticGraphRelevance";
import { consolidateRuntimeSemanticRootCauses } from "@/lib/harness/runtimeSemanticNarrative/consolidateRuntimeSemanticRootCauses";
import { buildSemanticNarrativePlanningTestFixtures } from "./narrativeTestFixtures";

describe("H18.5 evaluateRuntimeSemanticGraphRelevance", () => {
  it("ranks causal paths by relevance score", () => {
    const { semantic, graph } = buildSemanticNarrativePlanningTestFixtures();
    const groups = consolidateRuntimeSemanticRootCauses(semantic, graph);
    const summary = evaluateRuntimeSemanticGraphRelevance(semantic, graph, groups);
    expect(summary.mode).toBe("runtime_semantic_graph_relevance_summary");
    expect(summary.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(summary.rankedPaths.length).toBeLessThanOrEqual(6);
    if (summary.rankedPaths.length >= 2) {
      expect(summary.rankedPaths[0]!.relevanceScore).toBeGreaterThanOrEqual(
        summary.rankedPaths[1]!.relevanceScore
      );
    }
  });
});
