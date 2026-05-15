import { describe, expect, it } from "vitest";

import { buildRuntimeDecisionLineage } from "@/lib/harness/runtimeDecision/buildRuntimeDecisionLineage";
import { buildDecisionPlanningTestFixtures } from "./decisionTestFixtures";

describe("H19.5 buildRuntimeDecisionLineage", () => {
  it("builds capped decision lineage with read-only mode", () => {
    const { reasoning, semantic } = buildDecisionPlanningTestFixtures();
    const lineage = buildRuntimeDecisionLineage(reasoning, semantic);
    expect(lineage.mode).toBe("runtime_decision_lineage");
    expect(lineage.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(lineage.nodes.length).toBeGreaterThan(0);
    expect(lineage.lineagePaths.length).toBeLessThanOrEqual(5);
  });
});
