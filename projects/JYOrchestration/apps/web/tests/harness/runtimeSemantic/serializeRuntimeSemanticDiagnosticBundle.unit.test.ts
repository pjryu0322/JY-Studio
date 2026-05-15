import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { buildRuntimeSemanticGroups } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticGroups";
import { compressRuntimeReasoningTrace } from "@/lib/harness/runtimeSemantic/compressRuntimeReasoningTrace";
import { normalizeRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/normalizeRuntimePlanningContext";
import { buildRuntimeCriticalityPlanningReports } from "@/lib/harness/runtimeCriticality/buildRuntimeCriticalityPlanningReports";
import { buildRuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import { buildRuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import { buildRuntimeTraceabilityPlanningReports } from "@/lib/harness/runtimeTraceability/buildRuntimeTraceabilityPlanningReports";
import { serializeRuntimeSemanticDiagnosticBundleFromContext } from "@/lib/harness/runtimeSemantic/serializeRuntimeSemanticDiagnosticBundle";

describe("H17 runtime semantic compression", () => {
  it("builds semantic groups and compressed trace from reasoning reports", () => {
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
    const reasoning = buildRuntimeReasoningPlanningReports(dep, crit, trace);
    const groups = buildRuntimeSemanticGroups(reasoning);
    const compressed = compressRuntimeReasoningTrace(reasoning);
    expect(groups.mode).toBe("runtime_semantic_groups_summary");
    expect(groups.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(groups.groups.length).toBeGreaterThan(0);
    expect(compressed.mode).toBe("compressed_runtime_reasoning_trace");
    expect(compressed.compressedLines.length).toBeGreaterThan(0);
  });

  it("serializes seven H17–H17.5 diagnostic fields", () => {
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
    const b = serializeRuntimeSemanticDiagnosticBundleFromContext(ctx);
    const groups = b.runtimeSemanticGroups as { mode?: string; actualRuntimeOrchestrationEnabled?: boolean };
    const compressed = b.compressedRuntimeReasoningTrace as {
      mode?: string;
      actualRuntimeOrchestrationEnabled?: boolean;
    };
    const redundancy = b.runtimeSemanticRedundancySummary as {
      mode?: string;
      compressionApplied?: boolean;
    };
    const ordering = b.stabilizedRuntimeSemanticOrdering as { mode?: string };
    const quality = b.runtimeSemanticCompressionQualityReport as {
      mode?: string;
      quality?: string;
    };
    const hidden = b.runtimeHiddenSemanticTraceAudit as { mode?: string };
    const balance = b.runtimeSemanticGroupBalanceSummary as { mode?: string };
    expect(groups.mode).toBe("runtime_semantic_groups_summary");
    expect(groups.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(compressed.mode).toBe("compressed_runtime_reasoning_trace");
    expect(compressed.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(redundancy.mode).toBe("runtime_semantic_redundancy_summary");
    expect(redundancy.compressionApplied).toBe(true);
    expect(ordering.mode).toBe("stabilized_runtime_semantic_ordering");
    expect(quality.mode).toBe("runtime_semantic_compression_quality");
    expect(quality.quality).toBeTruthy();
    expect(hidden.mode).toBe("runtime_hidden_semantic_trace_audit");
    expect(balance.mode).toBe("runtime_semantic_group_balance_summary");
  });
});
