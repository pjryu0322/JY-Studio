import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildRuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import { serializeEnforcementGovernanceDiagnosticBundle } from "@/lib/harness/enforcementGovernance/serializeEnforcementGovernanceDiagnosticBundle";

describe("serializeEnforcementGovernanceDiagnosticBundle", () => {
  it("returns three H11.5 diagnostic fields", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const releaseGate = evaluateHarnessReleaseGateReadiness(baseline);
    const governanceCtx = buildRuntimeGovernancePlanningContext({ baseline, releaseGate, extract: null });
    const b = serializeEnforcementGovernanceDiagnosticBundle({
      baseline,
      releaseGate,
      governanceCtx,
      extract: null,
      messageExplainabilityAvailable: true,
      overlayWarningCount: 0,
    });
    const gov = b.controlledEnforcementGovernance as { mode?: string; actualEnforcementGovernanceEnabled?: boolean };
    const dep = b.governanceDependencyPlanning as { mode?: string; actualEnforcementEnabled?: boolean };
    const risk = b.governanceRiskSummary as { mode?: string; governanceRiskLevel?: string };
    expect(gov.mode).toBe("controlled_enforcement_governance_planning");
    expect(gov.actualEnforcementGovernanceEnabled).toBe(false);
    expect(dep.mode).toBe("governance_dependency_planning_only");
    expect(dep.actualEnforcementEnabled).toBe(false);
    expect(risk.mode).toBe("governance_risk_summary");
    expect(["stable", "watch", "elevated", "high"]).toContain(risk.governanceRiskLevel);
  });
});
