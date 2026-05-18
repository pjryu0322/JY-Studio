import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildRuntimeCriticalityPlanningReports } from "@/lib/harness/runtimeCriticality/buildRuntimeCriticalityPlanningReports";
import { buildRuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import { buildUnifiedRuntimeReasoningChain } from "@/lib/harness/runtimeReasoning/buildUnifiedRuntimeReasoningChain";
import { normalizeRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/normalizeRuntimePlanningContext";
import { buildRuntimeTraceabilityPlanningReports } from "@/lib/harness/runtimeTraceability/buildRuntimeTraceabilityPlanningReports";
import { serializeRuntimeReasoningDiagnosticBundleFromContext } from "@/lib/harness/runtimeReasoning/serializeRuntimeReasoningDiagnosticBundle";

describe("H16.5 runtime planning reasoning consolidation", () => {
  it("builds unified reasoning chain from traceability reports", () => {
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
    const trace = buildRuntimeTraceabilityPlanningReports(ctx, dep, crit);
    const chain = buildUnifiedRuntimeReasoningChain(trace);
    expect(chain.mode).toBe("unified_runtime_reasoning_chain");
    expect(chain.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(chain.stableOrdering.length).toBeGreaterThan(0);
  });

  it("serializes three H16.5 diagnostic fields", () => {
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
    const b = serializeRuntimeReasoningDiagnosticBundleFromContext(ctx);
    const chain = b.unifiedRuntimeReasoningChain as { mode?: string; actualRuntimeOrchestrationEnabled?: boolean };
    const redundancy = b.runtimeReasoningRedundancySummary as {
      mode?: string;
      actualRuntimeOrchestrationEnabled?: boolean;
      consolidationApplied?: boolean;
    };
    const normalized = b.normalizedRuntimeReasoningTrace as {
      mode?: string;
      actualRuntimeOrchestrationEnabled?: boolean;
    };
    expect(chain.mode).toBe("unified_runtime_reasoning_chain");
    expect(chain.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(redundancy.mode).toBe("runtime_reasoning_redundancy_summary");
    expect(redundancy.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(redundancy.consolidationApplied).toBe(true);
    expect(normalized.mode).toBe("normalized_runtime_reasoning_trace");
    expect(normalized.actualRuntimeOrchestrationEnabled).toBe(false);
  });
});
