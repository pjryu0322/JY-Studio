import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildRuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import { normalizeRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/normalizeRuntimePlanningContext";
import { evaluateRuntimePlanningCriticality } from "@/lib/harness/runtimeCriticality/evaluateRuntimePlanningCriticality";
import { serializeRuntimeCriticalityDiagnosticBundleFromContext } from "@/lib/harness/runtimeCriticality/serializeRuntimeCriticalityDiagnosticBundle";

describe("H15.5 runtime planning criticality", () => {
  it("evaluates criticality from dependency reports", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const releaseGate = evaluateHarnessReleaseGateReadiness(baseline);
    const ctx = normalizeRuntimePlanningContext({
      overlay: null,
      maturityBaseline: baseline,
      releaseGate,
      messageExplainabilityAvailable: true,
      overlayWarningCount: 0,
    });
    const dep = buildRuntimeDependencyPlanningReports(ctx);
    const summary = evaluateRuntimePlanningCriticality(ctx, dep);
    expect(summary.mode).toBe("runtime_planning_criticality_summary");
    expect(summary.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(summary.criticalityScore).toBeGreaterThanOrEqual(0);
    expect(summary.criticalityScore).toBeLessThanOrEqual(100);
  });

  it("serializes three H15.5 diagnostic fields", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const releaseGate = evaluateHarnessReleaseGateReadiness(baseline);
    const ctx = normalizeRuntimePlanningContext({
      overlay: null,
      maturityBaseline: baseline,
      releaseGate,
      messageExplainabilityAvailable: true,
      overlayWarningCount: 0,
    });
    const b = serializeRuntimeCriticalityDiagnosticBundleFromContext(ctx);
    const crit = b.runtimePlanningCriticalitySummary as { mode?: string; actualRuntimeOrchestrationEnabled?: boolean };
    const prop = b.runtimePriorityPropagationSummary as { mode?: string; actualRuntimeOrchestrationEnabled?: boolean };
    const flow = b.runtimeEscalationPriorityFlowSummary as { mode?: string; actualRuntimeOrchestrationEnabled?: boolean };
    expect(crit.mode).toBe("runtime_planning_criticality_summary");
    expect(crit.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(prop.mode).toBe("runtime_priority_propagation_summary");
    expect(prop.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(flow.mode).toBe("runtime_escalation_priority_flow_summary");
    expect(flow.actualRuntimeOrchestrationEnabled).toBe(false);
  });
});
