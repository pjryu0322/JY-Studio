import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildRuntimeCriticalityPlanningReports } from "@/lib/harness/runtimeCriticality/buildRuntimeCriticalityPlanningReports";
import { buildRuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import { buildPlanningReasoningChain } from "@/lib/harness/runtimeTraceability/buildPlanningReasoningChain";
import { normalizeRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/normalizeRuntimePlanningContext";
import { serializeRuntimeTraceabilityDiagnosticBundleFromContext } from "@/lib/harness/runtimeTraceability/serializeRuntimeTraceabilityDiagnosticBundle";

describe("H16 runtime planning traceability", () => {
  it("builds reasoning chain from dependency and criticality reports", () => {
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
    const crit = buildRuntimeCriticalityPlanningReports(ctx, dep);
    const chain = buildPlanningReasoningChain(ctx, dep, crit);
    expect(chain.mode).toBe("runtime_planning_reasoning_chain");
    expect(chain.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(chain.reasoningSteps.length).toBeGreaterThan(0);
  });

  it("serializes three H16 diagnostic fields", () => {
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
    const b = serializeRuntimeTraceabilityDiagnosticBundleFromContext(ctx);
    const chain = b.runtimePlanningReasoningChain as { mode?: string; actualRuntimeOrchestrationEnabled?: boolean };
    const dep = b.runtimeDependencyReasoningTraceSummary as {
      mode?: string;
      actualRuntimeOrchestrationEnabled?: boolean;
    };
    const pri = b.runtimePriorityReasoningTraceSummary as {
      mode?: string;
      actualRuntimeOrchestrationEnabled?: boolean;
    };
    expect(chain.mode).toBe("runtime_planning_reasoning_chain");
    expect(chain.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(dep.mode).toBe("runtime_dependency_reasoning_trace_summary");
    expect(dep.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(pri.mode).toBe("runtime_priority_reasoning_trace_summary");
    expect(pri.actualRuntimeOrchestrationEnabled).toBe(false);
  });
});
