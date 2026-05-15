import { describe, expect, it } from "vitest";

import { evaluateResourcePressure, summarizeResourcePressureForDiagnostic } from "@/lib/harness/resourceStabilization/evaluateResourcePressure";

describe("evaluateResourcePressure", () => {
  it("returns stable severity for empty extract", () => {
    const ev = evaluateResourcePressure(null);
    expect(ev.pressureSeverity).toBe("stable");
    expect(ev.compositeScore).toBeLessThan(40);
  });

  it("escalates severity with many warnings and blocks", () => {
    const ev = evaluateResourcePressure({
      overlayPolicyWarnings: Array.from({ length: 10 }, (_, i) => ({
        code: `w${i}`,
        severity: "warning" as const,
        message: "m",
        source: "diagnostic" as const,
        enforcement: "not_applied" as const,
      })),
      overlayContextAssemblyPlan: Array.from({ length: 6 }, (_, i) => ({
        type: "memory" as const,
        source: `s${i}`,
        priority: 1,
        includeReason: "r",
        estimatedCost: 200,
        includeMode: "required" as const,
        pruningCandidate: false,
      })),
    });
    expect(["elevated", "high", "critical"]).toContain(ev.pressureSeverity);
  });
});

describe("summarizeResourcePressureForDiagnostic", () => {
  it("serializes evaluation for API", () => {
    const s = summarizeResourcePressureForDiagnostic(null);
    expect(s.pressureSeverity).toBeDefined();
    expect(Array.isArray(s.contributingFactors)).toBe(true);
  });
});
