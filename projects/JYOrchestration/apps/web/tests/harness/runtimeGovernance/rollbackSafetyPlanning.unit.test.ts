import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { evaluateRuntimeTrialReadiness } from "@/lib/harness/runtimeTrial/evaluateRuntimeTrialReadiness";
import {
  buildRollbackSafetyPlanning,
  serializeRollbackSafetyPlanningForDiagnostic,
} from "@/lib/harness/runtimeGovernance/rollbackSafetyPlanning";

describe("buildRollbackSafetyPlanning", () => {
  it("never enables rollback execution", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const releaseGate = evaluateHarnessReleaseGateReadiness(baseline);
    const trial = evaluateRuntimeTrialReadiness({ baseline, releaseGate, extract: null });
    const r = buildRollbackSafetyPlanning({
      baseline,
      releaseGate,
      trialReadiness: trial,
      extract: null,
    });
    expect(r.actualRollbackExecutionEnabled).toBe(false);
    expect(["stable", "watch", "high"]).toContain(r.rollbackRisk);
    const w = serializeRollbackSafetyPlanningForDiagnostic(r);
    expect(w.rollbackRisk).toBe(r.rollbackRisk);
  });
});
