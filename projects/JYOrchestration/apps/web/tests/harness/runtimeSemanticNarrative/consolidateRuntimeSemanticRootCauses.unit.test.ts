import { describe, expect, it } from "vitest";

import { consolidateRuntimeSemanticRootCauses } from "@/lib/harness/runtimeSemanticNarrative/consolidateRuntimeSemanticRootCauses";
import { buildSemanticNarrativePlanningTestFixtures } from "./narrativeTestFixtures";

describe("H18.5 consolidateRuntimeSemanticRootCauses", () => {
  it("groups root causes and collapses duplicate warnings", () => {
    const { semantic, graph } = buildSemanticNarrativePlanningTestFixtures();
    const groups = consolidateRuntimeSemanticRootCauses(semantic, graph);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.length).toBeLessThanOrEqual(5);
    for (const g of groups) {
      expect(g.labelKo.length).toBeGreaterThan(0);
      expect(g.primaryChain.length).toBeGreaterThan(0);
    }
  });
});
