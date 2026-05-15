import { describe, expect, it } from "vitest";

import { serializeRuntimeRiskSummaryForDiagnostic } from "@/lib/harness/runtimeTrial/runtimeRiskSummary";

describe("serializeRuntimeRiskSummaryForDiagnostic", () => {
  it("copies risk factors for JSON-safe wire", () => {
    const factors = ["a", "b"];
    const w = serializeRuntimeRiskSummaryForDiagnostic({
      overallRiskLabelKo: "중간",
      riskFactors: factors,
      resourcePressureSeverity: "stable",
      releaseGateReadinessLevel: "candidate_for_manual_review",
    });
    expect(w.overallRiskLabelKo).toBe("중간");
    expect([...w.riskFactors]).toEqual(["a", "b"]);
    expect(w.riskFactors).not.toBe(factors);
  });
});
