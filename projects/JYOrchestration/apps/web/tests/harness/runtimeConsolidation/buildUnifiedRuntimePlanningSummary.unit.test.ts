import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildUnifiedRuntimePlanningSummary } from "@/lib/harness/runtimeConsolidation/buildUnifiedRuntimePlanningSummary";
import { normalizeRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/normalizeRuntimePlanningContext";
import { serializeRuntimeConsolidationDiagnosticBundleFromContext } from "@/lib/harness/runtimeConsolidation/serializeRuntimeConsolidationDiagnosticBundle";

describe("H14.5 runtime planning consolidation", () => {
  it("builds unified summary from normalized context", () => {
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
    const unified = buildUnifiedRuntimePlanningSummary(ctx);
    expect(unified.mode).toBe("unified_runtime_planning_summary");
    expect(unified.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(unified.stability.headline.length).toBeGreaterThan(0);
    expect(unified.coherence.headline.length).toBeGreaterThan(0);
  });

  it("serializes consolidation diagnostic fields", () => {
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
    const b = serializeRuntimeConsolidationDiagnosticBundleFromContext(ctx);
    const u = b.unifiedRuntimePlanningSummary as { mode?: string; actualRuntimeOrchestrationEnabled?: boolean };
    const r = b.runtimePlanningRedundancySummary as {
      mode?: string;
      consolidationApplied?: boolean;
      actualRuntimeOrchestrationEnabled?: boolean;
    };
    expect(u.mode).toBe("unified_runtime_planning_summary");
    expect(u.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(r.mode).toBe("runtime_planning_redundancy_summary");
    expect(r.consolidationApplied).toBe(true);
    expect(r.actualRuntimeOrchestrationEnabled).toBe(false);
  });
});
