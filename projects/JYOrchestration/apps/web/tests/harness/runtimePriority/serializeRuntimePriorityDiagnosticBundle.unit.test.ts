import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildRuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import { buildRuntimeEnforcementPlanningContext } from "@/lib/harness/runtimeEnforcement/buildRuntimeEnforcementPlanningContext";
import { buildRuntimeStabilityPlanningReports } from "@/lib/harness/runtimeStability/buildRuntimeStabilityPlanningReports";
import { serializeRuntimePriorityDiagnosticBundleFromStabilityReports } from "@/lib/harness/runtimePriority/serializeRuntimePriorityDiagnosticBundle";

describe("serializeRuntimePriorityDiagnosticBundleFromStabilityReports", () => {
  it("returns three H12.5 diagnostic fields", () => {
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
    const stabilityReports = buildRuntimeStabilityPlanningReports({
      baseline,
      releaseGate,
      governanceCtx,
      enforcementPlanning,
      extract: null,
      messageExplainabilityAvailable: true,
      overlayWarningCount: 0,
    });
    const b = serializeRuntimePriorityDiagnosticBundleFromStabilityReports({
      baseline,
      governanceCtx,
      stabilityReports,
      extract: null,
      messageExplainabilityAvailable: true,
    });
    const dep = b.runtimePlanningDependencyReport as { mode?: string; actualRuntimeOrchestrationEnabled?: boolean };
    const esc = b.runtimeEscalationSummary as { mode?: string; actualRuntimeOrchestrationEnabled?: boolean };
    const bn = b.runtimePlanningBottleneckSummary as { mode?: string; actualRuntimeOrchestrationEnabled?: boolean };
    expect(dep.mode).toBe("runtime_planning_dependency_report");
    expect(dep.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(esc.mode).toBe("runtime_escalation_summary");
    expect(esc.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(bn.mode).toBe("runtime_planning_bottleneck_summary");
    expect(bn.actualRuntimeOrchestrationEnabled).toBe(false);
  });
});
