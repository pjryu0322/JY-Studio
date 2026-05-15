import { describe, expect, it } from "vitest";

import { buildRuntimeSemanticVocabularyDictionary } from "@/lib/harness/runtimeSemanticVocabulary/buildRuntimeSemanticVocabularyDictionary";
import { buildSemanticVocabularyPlanningTestFixtures } from "./vocabularyTestFixtures";

describe("H19 buildRuntimeSemanticVocabularyDictionary", () => {
  it("builds vocabulary groups with collapsed duplicates", () => {
    const { semantic, graph, narrative } = buildSemanticVocabularyPlanningTestFixtures();
    const summary = buildRuntimeSemanticVocabularyDictionary(semantic, graph, narrative);
    expect(summary.mode).toBe("runtime_semantic_vocabulary_summary");
    expect(summary.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(summary.groups.length).toBeGreaterThan(0);
    expect(summary.normalizedLabels.length).toBeGreaterThan(0);
  });
});
