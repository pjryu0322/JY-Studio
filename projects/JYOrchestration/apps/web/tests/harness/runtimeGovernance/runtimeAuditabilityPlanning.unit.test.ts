import { describe, expect, it } from "vitest";

import {
  buildRuntimeAuditabilitySummary,
  serializeRuntimeAuditabilitySummaryForDiagnostic,
} from "@/lib/harness/runtimeGovernance/runtimeAuditabilityPlanning";

describe("buildRuntimeAuditabilitySummary", () => {
  it("lists planned trace targets without persistence", () => {
    const s = buildRuntimeAuditabilitySummary();
    expect(s.actualAuditPersistenceEnabled).toBe(false);
    expect(s.plannedTraceTargets.length).toBeGreaterThanOrEqual(4);
    const w = serializeRuntimeAuditabilitySummaryForDiagnostic(s);
    expect(Array.isArray(w.plannedTraceTargets)).toBe(true);
  });
});
