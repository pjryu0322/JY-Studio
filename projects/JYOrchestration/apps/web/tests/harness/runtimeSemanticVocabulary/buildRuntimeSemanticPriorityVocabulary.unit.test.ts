import { describe, expect, it } from "vitest";

import { buildRuntimeSemanticPriorityVocabulary } from "@/lib/harness/runtimeSemanticVocabulary/buildRuntimeSemanticPriorityVocabulary";
import { buildSemanticVocabularyPlanningTestFixtures } from "./vocabularyTestFixtures";

describe("H19 buildRuntimeSemanticPriorityVocabulary", () => {
  it("returns stable priority vocabulary with read-only mode", () => {
    const { semantic, graph, narrative } = buildSemanticVocabularyPlanningTestFixtures();
    const vocabulary = buildRuntimeSemanticPriorityVocabulary(semantic, graph, narrative);
    expect(vocabulary.mode).toBe("runtime_semantic_priority_vocabulary");
    expect(vocabulary.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(vocabulary.priorities.length).toBeGreaterThan(0);
    expect(vocabulary.topPriorityLabelKo.length).toBeGreaterThan(0);
  });
});
