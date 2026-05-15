import { describe, expect, it } from "vitest";

import { evaluateRuntimeSemanticCompressionQuality } from "@/lib/harness/runtimeSemantic/evaluateRuntimeSemanticCompressionQuality";
import { buildSemanticPlanningTestFixtures } from "./semanticTestFixtures";

describe("evaluateRuntimeSemanticCompressionQuality", () => {
  it("returns compression quality report with orchestration disabled", () => {
    const { reasoning, semantic } = buildSemanticPlanningTestFixtures();
    const report = evaluateRuntimeSemanticCompressionQuality({
      reasoningReports: reasoning,
      semanticGroupsSummary: semantic.semanticGroupsSummary,
      compressedReasoningTrace: semantic.compressedReasoningTrace,
      semanticRedundancySummary: semantic.semanticRedundancySummary,
      stabilizedSemanticOrdering: semantic.stabilizedSemanticOrdering,
      hiddenTraceAudit: semantic.hiddenTraceAudit,
    });
    expect(report.mode).toBe("runtime_semantic_compression_quality");
    expect(report.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(["safe", "watch", "over_compressed", "under_compressed"]).toContain(report.quality);
  });
});
