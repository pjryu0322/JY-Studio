import { describe, expect, it } from "vitest";

import { buildRuntimeSemanticNarratives } from "@/lib/harness/runtimeSemanticNarrative/buildRuntimeSemanticNarratives";
import { consolidateRuntimeSemanticRootCauses } from "@/lib/harness/runtimeSemanticNarrative/consolidateRuntimeSemanticRootCauses";
import { evaluateRuntimeSemanticGraphRelevance } from "@/lib/harness/runtimeSemanticNarrative/evaluateRuntimeSemanticGraphRelevance";
import { buildSemanticNarrativePlanningTestFixtures } from "./narrativeTestFixtures";

describe("H18.5 buildRuntimeSemanticNarratives", () => {
  it("builds deterministic narratives without duplicate text", () => {
    const { semantic, graph } = buildSemanticNarrativePlanningTestFixtures();
    const groups = consolidateRuntimeSemanticRootCauses(semantic, graph);
    const relevance = evaluateRuntimeSemanticGraphRelevance(semantic, graph, groups);
    const summary = buildRuntimeSemanticNarratives(groups, relevance);
    expect(summary.mode).toBe("runtime_semantic_narrative_summary");
    expect(summary.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(summary.topNarrativeKo.length).toBeGreaterThan(0);
    const texts = summary.narratives.map((n) => n.narrativeKo);
    expect(new Set(texts).size).toBe(texts.length);
  });
});
