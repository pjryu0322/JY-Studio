import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { serializeRuntimeEnforcementDiagnosticBundle } from "@/lib/harness/runtimeEnforcement/serializeRuntimeEnforcementDiagnosticBundle";
import { buildRuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";

describe("serializeRuntimeEnforcementDiagnosticBundle", () => {
  it("returns three H11 diagnostic fields", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const releaseGate = evaluateHarnessReleaseGateReadiness(baseline);
    const governanceCtx = buildRuntimeGovernancePlanningContext({ baseline, releaseGate, extract: null });
    const b = serializeRuntimeEnforcementDiagnosticBundle({
      baseline,
      releaseGate,
      governanceCtx,
      extract: null,
      messageExplainabilityAvailable: true,
      overlayWarningCount: 0,
    });
    const cand = b.runtimeEnforcementCandidate as { mode?: string; actualRuntimeEnforcementEnabled?: boolean };
    const risk = b.runtimeEnforcementRiskSummary as { mode?: string };
    const cap = b.candidateCapabilityPlanning as { mode?: string; actualEnforcementEnabled?: boolean };
    expect(cand.mode).toBe("runtime_enforcement_candidate_planning");
    expect(risk.mode).toBe("runtime_enforcement_risk_summary");
    expect(cap.mode).toBe("candidate_capability_planning_only");
    expect(cap.actualEnforcementEnabled).toBe(false);
  });
});
