import { describe, expect, it } from "vitest";

import { evaluateRuntimeSemanticGroupBalance } from "@/lib/harness/runtimeSemantic/evaluateRuntimeSemanticGroupBalance";
import { buildSemanticPlanningTestFixtures } from "./semanticTestFixtures";

describe("evaluateRuntimeSemanticGroupBalance", () => {
  it("returns group balance summary with orchestration disabled", () => {
    const { semantic } = buildSemanticPlanningTestFixtures();
    const balance = evaluateRuntimeSemanticGroupBalance(semantic.semanticGroupsSummary);
    expect(balance.mode).toBe("runtime_semantic_group_balance_summary");
    expect(balance.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(["balanced", "watch", "imbalanced"]).toContain(balance.balanceLevel);
  });
});
