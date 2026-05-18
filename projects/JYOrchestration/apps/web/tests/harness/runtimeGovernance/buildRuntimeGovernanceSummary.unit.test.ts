import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { evaluateRuntimeTrialReadiness } from "@/lib/harness/runtimeTrial/evaluateRuntimeTrialReadiness";
import {
  buildRuntimeGovernanceSummary,
  serializeRuntimeGovernanceSummaryForDiagnostic,
} from "@/lib/harness/runtimeGovernance/buildRuntimeGovernanceSummary";

describe("buildRuntimeGovernanceSummary", () => {
  it("returns planning-only flags and no enforcement", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const releaseGate = evaluateHarnessReleaseGateReadiness(baseline);
    const trial = evaluateRuntimeTrialReadiness({ baseline, releaseGate, extract: null });
    const g = buildRuntimeGovernanceSummary({
      baseline,
      releaseGate,
      trialReadiness: trial,
      extract: null,
    });
    expect(g.mode).toBe("controlled_runtime_governance_planning");
    expect(g.actualGovernanceEnforcementEnabled).toBe(false);
    expect(g.actualApprovalEnforcementEnabled).toBe(false);
    expect(g.actualRollbackExecutionEnabled).toBe(false);
    expect(["manual_only", "operator_review_required", "disabled"]).toContain(g.approvalMode);
    const wire = serializeRuntimeGovernanceSummaryForDiagnostic(g);
    expect(Array.isArray(wire.blockers)).toBe(true);
    expect(wire.actualGovernanceEnforcementEnabled).toBe(false);
  });
});
