import { describe, expect, it } from "vitest";

import { buildRuntimeControlledPilotPlanningReports } from "@/lib/harness/runtimeControlledPilot/buildRuntimeControlledPilotPlanningReports";
import { serializeRuntimeControlledPilotDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeControlledPilot/serializeRuntimeControlledPilotDiagnosticBundle";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { normalizeRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/normalizeRuntimePlanningContext";
import { buildRuntimeCriticalityPlanningReports } from "@/lib/harness/runtimeCriticality/buildRuntimeCriticalityPlanningReports";
import { buildRuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import { buildRuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import { buildRuntimeTraceabilityPlanningReports } from "@/lib/harness/runtimeTraceability/buildRuntimeTraceabilityPlanningReports";

function buildFullSemantic() {
  const maturityBaseline = evaluateHarnessMaturityBaseline({
    overlayExtract: null,
    harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
    recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
    messageExplainabilityAvailable: true,
  });
  const ctx = normalizeRuntimePlanningContext({
    overlay: null,
    maturityBaseline,
    releaseGate: evaluateHarnessReleaseGateReadiness(maturityBaseline),
    messageExplainabilityAvailable: true,
    overlayWarningCount: 0,
  });
  const dep = buildRuntimeDependencyPlanningReports(ctx);
  const crit = buildRuntimeCriticalityPlanningReports(ctx, dep);
  const trace = buildRuntimeTraceabilityPlanningReports(ctx, dep, crit);
  const reasoning = buildRuntimeReasoningPlanningReports(dep, crit, trace);
  return buildRuntimeSemanticPlanningReports(reasoning);
}

describe("H24 runtime controlled orchestration pilot metadata", () => {
  it("full semantic includes controlled pilot reports with execution flags false", () => {
    const semantic = buildFullSemantic();
    expect(semantic.runtimeControlledPilotSummary.actualPilotExecutionEnabled).toBe(false);
    expect(semantic.runtimeControlledPilotSummary.actualProviderRoutingEnabled).toBe(false);
    expect(semantic.runtimeControlledPilotSafetyEnvelope.actualRollbackExecutionEnabled).toBe(false);
    expect(semantic.runtimeControlledPilotFallbackPlan.actualRollbackExecutionEnabled).toBe(false);
  });

  it("buildRuntimeControlledPilotPlanningReports merges from operator approval layer", () => {
    const semantic = buildFullSemantic();
    const {
      runtimeControlledPilotSummary: _a,
      runtimeControlledPilotSafetyEnvelope: _b,
      runtimeControlledPilotFallbackPlan: _c,
      runtimeControlledPilotAbortConditions: _d,
      ...before
    } = semantic;
    const h24 = buildRuntimeControlledPilotPlanningReports(before);
    expect(h24.runtimeControlledPilotSummary.mode).toBe("runtime_controlled_pilot_summary");
    expect(h24.runtimeControlledPilotSafetyEnvelope.allowedPilotMetadataScopes.length).toBeGreaterThanOrEqual(0);
  });

  it("serializes controlled pilot diagnostic bundle with sorted string arrays", () => {
    const semantic = buildFullSemantic();
    const ser = serializeRuntimeControlledPilotDiagnosticBundleFromSemanticReports(semantic);
    expect(ser.runtimeControlledPilotSummary.mode).toBe("runtime_controlled_pilot_summary");
    expect(ser.runtimeControlledPilotSafetyEnvelope.mode).toBe("runtime_controlled_pilot_safety_envelope");
    expect(ser.runtimeControlledPilotSummary.safetyBlockers).toEqual(
      [...(ser.runtimeControlledPilotSummary.safetyBlockers as string[])].sort((a, b) => a.localeCompare(b, "ko"))
    );
  });
});
