import { describe, expect, it } from "vitest";

import { evaluateRuntimeSemanticExplosionRisk } from "@/lib/harness/runtimeSemanticGraph/evaluateRuntimeSemanticExplosionRisk";
import { buildSemanticPlanningTestFixtures } from "../runtimeSemantic/semanticTestFixtures";

describe("H18 evaluateRuntimeSemanticExplosionRisk", () => {
  it("returns explosion risk summary with read-only mode", () => {
    const { semantic } = buildSemanticPlanningTestFixtures();
    const summary = evaluateRuntimeSemanticExplosionRisk(semantic);
    expect(summary.mode).toBe("runtime_semantic_explosion_risk_summary");
    expect(summary.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(["low", "medium", "high"]).toContain(summary.explosionRisk);
    expect(summary.semanticGroupCount).toBeGreaterThan(0);
  });
});
