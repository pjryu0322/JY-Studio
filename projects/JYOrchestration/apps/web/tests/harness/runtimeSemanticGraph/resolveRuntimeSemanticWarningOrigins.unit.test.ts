import { describe, expect, it } from "vitest";

import { resolveRuntimeSemanticWarningOrigins } from "@/lib/harness/runtimeSemanticGraph/resolveRuntimeSemanticWarningOrigins";
import { buildSemanticPlanningTestFixtures } from "../runtimeSemantic/semanticTestFixtures";

describe("H18 resolveRuntimeSemanticWarningOrigins", () => {
  it("returns warning origin summary with read-only mode", () => {
    const { semantic } = buildSemanticPlanningTestFixtures();
    const summary = resolveRuntimeSemanticWarningOrigins(semantic);
    expect(summary.mode).toBe("runtime_semantic_warning_origin_summary");
    expect(summary.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(Array.isArray(summary.origins)).toBe(true);
    expect(Array.isArray(summary.primaryOriginChain)).toBe(true);
  });
});
