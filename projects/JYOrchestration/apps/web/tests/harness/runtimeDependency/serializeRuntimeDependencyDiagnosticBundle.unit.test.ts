import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildRuntimePlanningDependencyGraph } from "@/lib/harness/runtimeDependency/buildRuntimePlanningDependencyGraph";
import { normalizeRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/normalizeRuntimePlanningContext";
import { serializeRuntimeDependencyDiagnosticBundleFromContext } from "@/lib/harness/runtimeDependency/serializeRuntimeDependencyDiagnosticBundle";

describe("H15 runtime planning dependency graph", () => {
  it("builds dependency graph nodes from normalized context", () => {
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
    const graph = buildRuntimePlanningDependencyGraph(ctx);
    expect(graph.mode).toBe("runtime_planning_dependency_graph");
    expect(graph.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it("serializes three H15 diagnostic fields", () => {
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
    const b = serializeRuntimeDependencyDiagnosticBundleFromContext(ctx);
    const graph = b.runtimePlanningDependencyGraph as { mode?: string; actualRuntimeOrchestrationEnabled?: boolean };
    const impact = b.runtimePlanningImpactPropagationSummary as {
      mode?: string;
      actualRuntimeOrchestrationEnabled?: boolean;
    };
    const conflict = b.runtimePlanningDependencyConflictSummary as {
      mode?: string;
      actualRuntimeOrchestrationEnabled?: boolean;
    };
    expect(graph.mode).toBe("runtime_planning_dependency_graph");
    expect(graph.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(impact.mode).toBe("runtime_planning_impact_propagation_summary");
    expect(impact.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(conflict.mode).toBe("runtime_planning_dependency_conflict_summary");
    expect(conflict.actualRuntimeOrchestrationEnabled).toBe(false);
  });
});
