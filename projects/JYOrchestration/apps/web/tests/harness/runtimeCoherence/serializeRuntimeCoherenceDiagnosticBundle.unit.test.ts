import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildRuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import { buildRuntimeEnforcementPlanningContext } from "@/lib/harness/runtimeEnforcement/buildRuntimeEnforcementPlanningContext";
import { buildRuntimeStabilityPlanningReports } from "@/lib/harness/runtimeStability/buildRuntimeStabilityPlanningReports";
import { buildRuntimePriorityPlanningReports } from "@/lib/harness/runtimePriority/buildRuntimePriorityPlanningReports";
import { buildRuntimeLifecyclePlanningReports } from "@/lib/harness/runtimeLifecycle/buildRuntimeLifecyclePlanningReports";
import { serializeRuntimeCoherenceDiagnosticBundleFromPlanningReports } from "@/lib/harness/runtimeCoherence/serializeRuntimeCoherenceDiagnosticBundle";

describe("serializeRuntimeCoherenceDiagnosticBundleFromPlanningReports", () => {
  it("returns three H14 diagnostic fields", () => {
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
    const lifecycleReports = buildRuntimeLifecyclePlanningReports({
      governanceCtx,
      stabilityReports,
      priorityReports,
    });
    const b = serializeRuntimeCoherenceDiagnosticBundleFromPlanningReports({
      stabilityReports,
      priorityReports,
      lifecycleReports,
    });
    const coh = b.runtimePlanningCoherenceSummary as { mode?: string; actualRuntimeOrchestrationEnabled?: boolean };
    const sync = b.runtimePlanningSynchronizationSummary as {
      mode?: string;
      actualRuntimeOrchestrationEnabled?: boolean;
    };
    const div = b.runtimePlanningDivergenceReport as { mode?: string; actualRuntimeOrchestrationEnabled?: boolean };
    expect(coh.mode).toBe("runtime_planning_coherence_summary");
    expect(coh.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(sync.mode).toBe("runtime_planning_synchronization_summary");
    expect(sync.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(div.mode).toBe("runtime_planning_divergence_report");
    expect(div.actualRuntimeOrchestrationEnabled).toBe(false);
  });
});
