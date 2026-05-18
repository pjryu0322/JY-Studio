import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildRuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";

describe("buildRuntimeGovernancePlanningContext", () => {
  it("builds trial, governance, rollback, and auditability together", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const releaseGate = evaluateHarnessReleaseGateReadiness(baseline);
    const ctx = buildRuntimeGovernancePlanningContext({ baseline, releaseGate, extract: null });
    expect(ctx.trialReadiness.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(ctx.governance.actualGovernanceEnforcementEnabled).toBe(false);
    expect(ctx.rollbackSafety.actualRollbackExecutionEnabled).toBe(false);
    expect(ctx.auditability.actualAuditPersistenceEnabled).toBe(false);
    expect(ctx.auditability.plannedTraceTargets.length).toBeGreaterThan(0);
  });
});
