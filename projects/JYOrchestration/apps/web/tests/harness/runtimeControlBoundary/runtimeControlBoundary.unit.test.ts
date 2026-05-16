import { describe, expect, it } from "vitest";

import type { RuntimeSemanticPlanningReportsBeforeControlBoundary } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { buildRuntimeControlBoundaryPlanningReports } from "@/lib/harness/runtimeControlBoundary/buildRuntimeControlBoundaryPlanningReports";
import { detectRuntimeControlBoundaryViolations } from "@/lib/harness/runtimeControlBoundary/detectRuntimeControlBoundaryViolations";
import { evaluateRuntimeControlBoundary } from "@/lib/harness/runtimeControlBoundary/evaluateRuntimeControlBoundary";
import { serializeRuntimeControlBoundaryDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeControlBoundary/serializeRuntimeControlBoundaryDiagnosticBundle";
import { buildRuntimeResourceTrialPlanningReports } from "@/lib/harness/runtimeResourceTrial/buildRuntimeResourceTrialPlanningReports";
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

function buildPlanningContext() {
  const maturityBaseline = evaluateHarnessMaturityBaseline({
    overlayExtract: null,
    harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
    recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
    messageExplainabilityAvailable: true,
  });
  return normalizeRuntimePlanningContext({
    overlay: null,
    maturityBaseline,
    releaseGate: evaluateHarnessReleaseGateReadiness(maturityBaseline),
    messageExplainabilityAvailable: true,
    overlayWarningCount: 0,
  });
}

function buildSemanticBeforeControlBoundary(): RuntimeSemanticPlanningReportsBeforeControlBoundary {
  const ctx = buildPlanningContext();
  const dep = buildRuntimeDependencyPlanningReports(ctx);
  const crit = buildRuntimeCriticalityPlanningReports(ctx, dep);
  const trace = buildRuntimeTraceabilityPlanningReports(ctx, dep, crit);
  const reasoning = buildRuntimeReasoningPlanningReports(dep, crit, trace);
  const semantic = buildRuntimeSemanticPlanningReports(reasoning);
  const {
    runtimeControlBoundarySummary: _s,
    runtimeControlBoundaryViolationReport: _v,
    runtimeControlScopeMatrix: _m,
    runtimeExecutionCandidateSummary: _e1,
    runtimeExecutionCandidateScope: _e2,
    runtimeExecutionCandidatePreconditions: _e3,
    runtimeExecutionCandidateBlockers: _e4,
    ...rest
  } = semantic;
  return rest as RuntimeSemanticPlanningReportsBeforeControlBoundary;
}

describe("H22.5 runtime control boundary", () => {
  it("full semantic reports include control boundary with actualControlEnabled false", () => {
    const ctx = buildPlanningContext();
    const dep = buildRuntimeDependencyPlanningReports(ctx);
    const crit = buildRuntimeCriticalityPlanningReports(ctx, dep);
    const trace = buildRuntimeTraceabilityPlanningReports(ctx, dep, crit);
    const reasoning = buildRuntimeReasoningPlanningReports(dep, crit, trace);
    const semantic = buildRuntimeSemanticPlanningReports(reasoning);
    expect(semantic.runtimeControlBoundarySummary.actualControlEnabled).toBe(false);
    expect(semantic.runtimeControlBoundaryViolationReport.actualControlEnabled).toBe(false);
    expect(semantic.runtimeControlScopeMatrix.mode).toBe("runtime_control_scope_matrix");
  });

  it("dry_run_blocked → actual_control_forbidden", () => {
    const before = buildSemanticBeforeControlBoundary();
    const trial = buildRuntimeResourceTrialPlanningReports(before);
    const withTrial = {
      ...before,
      ...trial,
      runtimeResourceAllocationTrialReport: {
        ...trial.runtimeResourceAllocationTrialReport,
        trialMode: "dry_run_blocked",
        blockedReasons: ["blocked"],
      },
    };
    expect(evaluateRuntimeControlBoundary(withTrial).boundaryLevel).toBe("actual_control_forbidden");
  });

  it("dry_run_ready → dry_run_metadata", () => {
    const before = buildSemanticBeforeControlBoundary();
    const trial = buildRuntimeResourceTrialPlanningReports(before);
    const withTrial = {
      ...before,
      ...trial,
      runtimeResourceControlBoundary: {
        ...before.runtimeResourceControlBoundary,
        boundary: "trial_candidate",
      },
      runtimeResourceAllocationPlan: {
        ...before.runtimeResourceAllocationPlan,
        globalAllocationMode: "dry_run_candidate",
      },
      runtimeResourceAllocationTrialReport: {
        ...trial.runtimeResourceAllocationTrialReport,
        trialMode: "dry_run_ready",
      },
    };
    expect(evaluateRuntimeControlBoundary(withTrial).boundaryLevel).toBe("dry_run_metadata");
  });

  it("planning_only allocation → planning_metadata", () => {
    const before = buildSemanticBeforeControlBoundary();
    const beforePlanning = {
      ...before,
      runtimeResourceAllocationPlan: {
        ...before.runtimeResourceAllocationPlan,
        globalAllocationMode: "planning_only" as const,
      },
      runtimeResourceControlBoundary: {
        ...before.runtimeResourceControlBoundary,
        boundary: "planning_only" as const,
      },
    };
    const trial = buildRuntimeResourceTrialPlanningReports(beforePlanning);
    const withTrial = { ...beforePlanning, ...trial };
    expect(evaluateRuntimeControlBoundary(withTrial).boundaryLevel).toBe("planning_metadata");
  });

  it("control_not_allowed governance boundary → actual_control_forbidden", () => {
    const before = buildSemanticBeforeControlBoundary();
    const trial = buildRuntimeResourceTrialPlanningReports(before);
    const withTrial = {
      ...before,
      ...trial,
      runtimeResourceControlBoundary: {
        ...before.runtimeResourceControlBoundary,
        boundary: "control_not_allowed" as const,
      },
    };
    expect(evaluateRuntimeControlBoundary(withTrial).boundaryLevel).toBe("actual_control_forbidden");
  });

  it("detects actualRuntimeOrchestrationEnabled=true in nested report", () => {
    const before = buildSemanticBeforeControlBoundary();
    const trial = buildRuntimeResourceTrialPlanningReports(before);
    const poisoned = {
      ...before,
      ...trial,
      runtimeResourceAllocationTrialReport: {
        ...before.runtimeResourceAllocationTrialReport,
        ...trial.runtimeResourceAllocationTrialReport,
        actualRuntimeOrchestrationEnabled: true as false,
      },
    } as unknown as RuntimeSemanticPlanningReportsBeforeControlBoundary;
    const v = detectRuntimeControlBoundaryViolations(poisoned);
    expect(v.actualFlagViolations.length).toBeGreaterThan(0);
  });

  it("detects provider switching wording", () => {
    const before = buildSemanticBeforeControlBoundary();
    const trial = buildRuntimeResourceTrialPlanningReports(before);
    const withTrial = {
      ...before,
      ...trial,
      runtimeResourceAllocationTrialReport: {
        ...trial.runtimeResourceAllocationTrialReport,
        recommendations: ["provider switching is enabled"],
      },
    };
    const v = detectRuntimeControlBoundaryViolations(withTrial);
    expect(v.wordingRiskFindings.some((w) => w.includes("provider switching"))).toBe(true);
  });

  it("serializer does not rebuild and keeps flags false", () => {
    const ctx = buildPlanningContext();
    const dep = buildRuntimeDependencyPlanningReports(ctx);
    const crit = buildRuntimeCriticalityPlanningReports(ctx, dep);
    const trace = buildRuntimeTraceabilityPlanningReports(ctx, dep, crit);
    const full = buildRuntimeSemanticPlanningReports(buildRuntimeReasoningPlanningReports(dep, crit, trace));
    const ser = serializeRuntimeControlBoundaryDiagnosticBundleFromSemanticReports(full);
    expect((ser.runtimeControlBoundarySummary as { actualControlEnabled?: boolean }).actualControlEnabled).toBe(
      false
    );
    expect((ser.runtimeControlScopeMatrix as { mode?: string }).mode).toBe("runtime_control_scope_matrix");
  });

  it("buildRuntimeControlBoundaryPlanningReports merges violation risk", () => {
    const before = buildSemanticBeforeControlBoundary();
    const trial = buildRuntimeResourceTrialPlanningReports(before);
    const withTrial = {
      ...before,
      ...trial,
      runtimeResourceAllocationTrialReport: {
        ...trial.runtimeResourceAllocationTrialReport,
        recommendations: ["execution blocking required"],
      },
    };
    const out = buildRuntimeControlBoundaryPlanningReports(withTrial);
    expect(out.runtimeControlBoundaryViolationReport.wordingRiskFindings.length).toBeGreaterThan(0);
    expect(
      out.runtimeControlBoundarySummary.boundaryRisk === "violation_candidate" ||
        out.runtimeControlBoundarySummary.boundaryRisk === "blocked"
    ).toBe(true);
  });
});
