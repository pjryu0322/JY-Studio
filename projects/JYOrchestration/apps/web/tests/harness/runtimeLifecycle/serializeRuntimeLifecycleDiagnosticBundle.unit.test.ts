import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildRuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import { buildRuntimeEnforcementPlanningContext } from "@/lib/harness/runtimeEnforcement/buildRuntimeEnforcementPlanningContext";
import { buildRuntimeStabilityPlanningReports } from "@/lib/harness/runtimeStability/buildRuntimeStabilityPlanningReports";
import { buildRuntimePriorityPlanningReports } from "@/lib/harness/runtimePriority/buildRuntimePriorityPlanningReports";
import { serializeRuntimeLifecycleDiagnosticBundleFromPlanningReports } from "@/lib/harness/runtimeLifecycle/serializeRuntimeLifecycleDiagnosticBundle";

describe("serializeRuntimeLifecycleDiagnosticBundleFromPlanningReports", () => {
  it("returns three H13.5 diagnostic fields", () => {
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
    const priorityReports = buildRuntimePriorityPlanningReports({
      baseline,
      governanceCtx,
      stabilityReports,
      extract: null,
      messageExplainabilityAvailable: true,
    });
    const b = serializeRuntimeLifecycleDiagnosticBundleFromPlanningReports({
      governanceCtx,
      stabilityReports,
      priorityReports,
    });
    const fresh = b.runtimePlanningFreshnessSummary as {
      mode?: string;
      actualRuntimeOrchestrationEnabled?: boolean;
    };
    const drift = b.runtimePlanningDriftReport as { mode?: string; actualRuntimeOrchestrationEnabled?: boolean };
    const inv = b.runtimePlanningInvalidationSummary as {
      mode?: string;
      actualRuntimeOrchestrationEnabled?: boolean;
    };
    expect(fresh.mode).toBe("runtime_planning_freshness_summary");
    expect(fresh.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(drift.mode).toBe("runtime_planning_drift_report");
    expect(drift.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(inv.mode).toBe("runtime_planning_invalidation_summary");
    expect(inv.actualRuntimeOrchestrationEnabled).toBe(false);
  });
});
