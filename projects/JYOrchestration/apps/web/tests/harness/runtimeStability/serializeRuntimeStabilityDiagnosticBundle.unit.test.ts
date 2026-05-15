import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildRuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import { buildRuntimeEnforcementPlanningContext } from "@/lib/harness/runtimeEnforcement/buildRuntimeEnforcementPlanningContext";
import { serializeRuntimeStabilityDiagnosticBundleFromEnforcementPlanning } from "@/lib/harness/runtimeStability/serializeRuntimeStabilityDiagnosticBundle";

describe("serializeRuntimeStabilityDiagnosticBundleFromEnforcementPlanning", () => {
  it("returns three H12 diagnostic fields", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const releaseGate = evaluateHarnessReleaseGateReadiness(baseline);
    const governanceCtx = buildRuntimeGovernancePlanningContext({ baseline, releaseGate, extract: null });
    const enforcementPlanning = buildRuntimeEnforcementPlanningContext({
      baseline,
      releaseGate,
      governanceCtx,
      extract: null,
      messageExplainabilityAvailable: true,
    });
    const b = serializeRuntimeStabilityDiagnosticBundleFromEnforcementPlanning({
      baseline,
      releaseGate,
      governanceCtx,
      enforcementPlanning,
      extract: null,
      messageExplainabilityAvailable: true,
      overlayWarningCount: 0,
    });
    const stab = b.runtimeStabilitySummary as { mode?: string; actualRuntimeEnforcementEnabled?: boolean };
    const conflict = b.runtimeCandidateConflictReport as { mode?: string; actualRuntimeEnforcementEnabled?: boolean };
    const sat = b.candidateSaturationSummary as { mode?: string; actualRuntimeEnforcementEnabled?: boolean };
    expect(stab.mode).toBe("runtime_stability_summary");
    expect(stab.actualRuntimeEnforcementEnabled).toBe(false);
    expect(conflict.mode).toBe("runtime_candidate_conflict_report");
    expect(conflict.actualRuntimeEnforcementEnabled).toBe(false);
    expect(sat.mode).toBe("candidate_saturation_summary");
    expect(sat.actualRuntimeEnforcementEnabled).toBe(false);
  });
});
