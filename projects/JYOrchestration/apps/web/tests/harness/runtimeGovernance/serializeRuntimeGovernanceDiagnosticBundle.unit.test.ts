import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { serializeRuntimeGovernanceDiagnosticBundle } from "@/lib/harness/runtimeGovernance/serializeRuntimeGovernanceDiagnosticBundle";

describe("serializeRuntimeGovernanceDiagnosticBundle", () => {
  it("returns three diagnostic wire fields", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const releaseGate = evaluateHarnessReleaseGateReadiness(baseline);
    const bundle = serializeRuntimeGovernanceDiagnosticBundle({ baseline, releaseGate, extract: null });
    expect(bundle.runtimeGovernanceSummary.actualGovernanceEnforcementEnabled).toBe(false);
    expect(bundle.rollbackSafetyPlanning.actualRollbackExecutionEnabled).toBe(false);
    expect(bundle.runtimeAuditabilitySummary.actualAuditPersistenceEnabled).toBe(false);
    expect(Array.isArray(bundle.runtimeGovernanceSummary.blockers)).toBe(true);
  });
});
