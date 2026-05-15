import { describe, expect, it } from "vitest";

import { auditHiddenRuntimeSemanticTrace } from "@/lib/harness/runtimeSemantic/auditHiddenRuntimeSemanticTrace";
import { buildSemanticPlanningTestFixtures } from "./semanticTestFixtures";

describe("auditHiddenRuntimeSemanticTrace", () => {
  it("audits hidden trace counts as read-only metadata", () => {
    const { reasoning, semantic } = buildSemanticPlanningTestFixtures();
    const audit = auditHiddenRuntimeSemanticTrace({
      reasoningReports: reasoning,
      compressedReasoningTrace: semantic.compressedReasoningTrace,
      semanticGroupsSummary: semantic.semanticGroupsSummary,
      stabilizedSemanticOrdering: semantic.stabilizedSemanticOrdering,
    });
    expect(audit.mode).toBe("runtime_hidden_semantic_trace_audit");
    expect(audit.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(audit.hiddenTraceCount).toBeGreaterThanOrEqual(0);
  });
});
