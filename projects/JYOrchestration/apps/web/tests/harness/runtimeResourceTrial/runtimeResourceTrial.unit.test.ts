import { describe, expect, it } from "vitest";

import type { RuntimeSemanticPlanningReportsBeforeTrial } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { buildRuntimeResourceTrialPlanningReports } from "@/lib/harness/runtimeResourceTrial/buildRuntimeResourceTrialPlanningReports";
import { compareRuntimeAllocationPlanWithForecast } from "@/lib/harness/runtimeResourceTrial/compareRuntimeAllocationPlanWithForecast";
import { compareRuntimeAllocationPlanWithGovernance } from "@/lib/harness/runtimeResourceTrial/compareRuntimeAllocationPlanWithGovernance";
import { evaluateRuntimeAllocationTrialDrift } from "@/lib/harness/runtimeResourceTrial/evaluateRuntimeAllocationTrialDrift";
import { evaluateRuntimeResourceAllocationTrial } from "@/lib/harness/runtimeResourceTrial/evaluateRuntimeResourceAllocationTrial";
import { serializeRuntimeResourceTrialDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeResourceTrial/serializeRuntimeResourceTrialDiagnosticBundle";
import { buildRuntimeControlBoundaryPlanningReports } from "@/lib/harness/runtimeControlBoundary/buildRuntimeControlBoundaryPlanningReports";
import { buildRuntimeExecutionCandidatePlanningReports } from "@/lib/harness/runtimeExecutionCandidate/buildRuntimeExecutionCandidatePlanningReports";
import { buildRuntimeOperatorApprovalPlanningReports } from "@/lib/harness/runtimeOperatorApproval/buildRuntimeOperatorApprovalPlanningReports";
import {
  buildRuntimeSemanticPlanningReports,
  type RuntimeSemanticPlanningReports,
} from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { normalizeRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/normalizeRuntimePlanningContext";
import { buildRuntimeCriticalityPlanningReports } from "@/lib/harness/runtimeCriticality/buildRuntimeCriticalityPlanningReports";
import { buildRuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import { buildRuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import { buildRuntimeTraceabilityPlanningReports } from "@/lib/harness/runtimeTraceability/buildRuntimeTraceabilityPlanningReports";

function emptyPolicyViolationCandidate() {
  return {
    mode: "runtime_resource_policy_violation_candidate" as const,
    actualRuntimeOrchestrationEnabled: false as const,
    risk: "none" as const,
    summaryKo: "",
  };
}

function baseMemberPlan(memberId: string) {
  return {
    memberId,
    allocationMode: "dry_run_candidate" as const,
    priorityRank: 1,
    tokenBudgetHintKo: "",
    congestionHintKo: "",
    timingHintKo: "",
  };
}

function baseWorkload(memberId: string, workloadLevel: "idle" | "balanced" | "elevated" | "saturated") {
  return {
    memberId,
    labelKo: "",
    workloadLevel,
    saturationRisk: "low" as const,
    noteKo: "",
  };
}

/** Minimal shape for H22 evaluators only (`as unknown as` for branch tests). */
function trialInput(
  overrides: Partial<{
    globalAllocationMode: "not_needed" | "planning_only" | "dry_run_candidate" | "blocked_by_governance";
    boundary: "observe_only" | "planning_only" | "trial_candidate" | "control_not_allowed";
    governanceRisk: "stable" | "watch" | "elevated" | "critical_candidate";
    forecastOutlook: "stable" | "watch" | "degrading" | "critical_candidate";
    escalationHighRiskCount: number;
    driftSeverities: readonly ("low" | "medium" | "high" | "critical_candidate")[];
    operatorReview: "not_required" | "recommended" | "required";
    memberPlans: ReturnType<typeof baseMemberPlan>[];
    workloadMembers: ReturnType<typeof baseWorkload>[];
    providerPressureSeverity: "low" | "medium" | "high" | "critical_candidate";
    coherenceLevel: "aligned" | "partial" | "divergent";
  }>
): RuntimeSemanticPlanningReportsBeforeTrial {
  const globalAllocationMode = overrides.globalAllocationMode ?? "dry_run_candidate";
  const memberPlans = overrides.memberPlans ?? [baseMemberPlan("m1")];
  const workloadMembers =
    overrides.workloadMembers ??
    memberPlans.map((p) => baseWorkload(p.memberId, "balanced"));

  return {
    runtimeResourceAllocationPlan: {
      mode: "runtime_resource_allocation_plan",
      actualRuntimeOrchestrationEnabled: false,
      actualResourceAllocationEnabled: false,
      globalAllocationMode,
      memberPlans,
      recommendationRows: [],
    },
    runtimeResourceControlBoundary: {
      mode: "runtime_resource_control_boundary",
      actualRuntimeOrchestrationEnabled: false,
      boundary: overrides.boundary ?? "trial_candidate",
      rationaleKo: "",
    },
    runtimeResourceGovernanceSummary: {
      mode: "runtime_resource_governance_summary",
      actualRuntimeOrchestrationEnabled: false,
      governanceMode: "trial_candidate",
      governanceRisk: overrides.governanceRisk ?? "stable",
      operatorReviewRequirement: overrides.operatorReview ?? "not_required",
      allocationReadiness: "allocation_planning_candidate",
      policyViolationCandidate: emptyPolicyViolationCandidate(),
      policyFindings: [],
      recommendations: [],
    },
    runtimeForecastStability: {
      mode: "runtime_forecast_stability",
      actualRuntimeOrchestrationEnabled: false,
      outlook: overrides.forecastOutlook ?? "stable",
      longitudinalNoteKo: "",
      coherenceDriftRiskKo: "",
      findings: [],
    },
    runtimeForecastEscalation: {
      mode: "runtime_forecast_escalation",
      actualRuntimeOrchestrationEnabled: false,
      chains: [],
      primaryChainKo: "",
      highRiskFirst: Array.from({ length: overrides.escalationHighRiskCount ?? 0 }, (_, i) => `c${i}`),
    },
    runtimeForecastGovernanceDrift: {
      mode: "runtime_forecast_governance_drift",
      actualRuntimeOrchestrationEnabled: false,
      drifts: (overrides.driftSeverities ?? []).map((severity, i) => ({
        kind: "semantic_mismatch" as const,
        severity,
        labelKo: `d${i}`,
      })),
      primaryDriftKo: "",
    },
    runtimeMemberWorkload: {
      mode: "runtime_member_workload",
      actualRuntimeOrchestrationEnabled: false,
      members: workloadMembers,
      imbalanceNoteKo: "",
      primaryOverloadKo: "",
    },
    runtimeResourceSummary: {
      mode: "runtime_resource_summary",
      actualRuntimeOrchestrationEnabled: false,
      pressures: [],
      overloadSummaryKo: "",
      primaryPressureKo: "",
      saturation: {
        mode: "runtime_resource_saturation",
        actualRuntimeOrchestrationEnabled: false,
        providerSaturationLevel: "low",
        queueSaturationLevel: "low",
        primarySaturationKo: "",
      },
      queue: {
        mode: "runtime_resource_queue",
        actualRuntimeOrchestrationEnabled: false,
        queueDepthLabel: "",
        overloadRiskKo: "",
      },
      providerPressure: {
        mode: "runtime_provider_pressure",
        actualRuntimeOrchestrationEnabled: false,
        severity: overrides.providerPressureSeverity ?? "low",
        summaryKo: "",
      },
      queuePressureInsight: {
        mode: "runtime_queue_pressure",
        actualRuntimeOrchestrationEnabled: false,
        amplificationLevel: "low",
        summaryKo: "",
      },
      bottleneckPropagation: {
        mode: "runtime_bottleneck_propagation",
        actualRuntimeOrchestrationEnabled: false,
        propagationSeverity: "low",
        bottleneckChainKo: "",
        slowdownRiskKo: "",
      },
    },
    runtimeDecisionCoherence: {
      mode: "runtime_decision_coherence",
      actualRuntimeOrchestrationEnabled: false,
      overallLevel: overrides.coherenceLevel ?? "aligned",
      summaryKo: "",
      findings: [],
    },
  } as unknown as RuntimeSemanticPlanningReportsBeforeTrial;
}

describe("H22 runtime resource allocation trial", () => {
  it("maps not_needed → not_applicable", () => {
    const reports = trialInput({ globalAllocationMode: "not_needed" });
    const out = buildRuntimeResourceTrialPlanningReports(reports);
    expect(out.runtimeResourceAllocationTrialReport.trialMode).toBe("not_applicable");
    expect(out.runtimeResourceAllocationTrialReport.actualTrialExecutionEnabled).toBe(false);
  });

  it("maps planning_only → dry_run_watch", () => {
    const reports = trialInput({ globalAllocationMode: "planning_only" });
    const out = buildRuntimeResourceTrialPlanningReports(reports);
    expect(out.runtimeResourceAllocationTrialReport.trialMode).toBe("dry_run_watch");
  });

  it("maps dry_run_candidate with stable governance and forecast → dry_run_ready", () => {
    const reports = trialInput({
      globalAllocationMode: "dry_run_candidate",
      governanceRisk: "stable",
      forecastOutlook: "stable",
    });
    const out = buildRuntimeResourceTrialPlanningReports(reports);
    expect(out.runtimeResourceAllocationTrialReport.trialMode).toBe("dry_run_ready");
  });

  it("maps blocked_by_governance → dry_run_blocked", () => {
    const reports = trialInput({ globalAllocationMode: "blocked_by_governance" });
    const out = buildRuntimeResourceTrialPlanningReports(reports);
    expect(out.runtimeResourceAllocationTrialReport.trialMode).toBe("dry_run_blocked");
    expect(out.runtimeResourceAllocationTrialReport.blockedReasons.length).toBeGreaterThan(0);
  });

  it("maps control_not_allowed boundary → dry_run_blocked", () => {
    const reports = trialInput({
      globalAllocationMode: "dry_run_candidate",
      boundary: "control_not_allowed",
    });
    const out = buildRuntimeResourceTrialPlanningReports(reports);
    expect(out.runtimeResourceAllocationTrialReport.trialMode).toBe("dry_run_blocked");
  });

  it("detects forecast misalignment for critical stability vs dry_run_candidate", () => {
    const reports = trialInput({
      globalAllocationMode: "dry_run_candidate",
      forecastOutlook: "critical_candidate",
    });
    const fc = compareRuntimeAllocationPlanWithForecast(reports);
    expect(fc.aligned).toBe(false);
    expect(fc.observations.some((o) => o.includes("critical_candidate"))).toBe(true);
  });

  it("detects governance mismatch for dry_run_candidate vs control_not_allowed", () => {
    const reports = trialInput({
      globalAllocationMode: "dry_run_candidate",
      boundary: "control_not_allowed",
    });
    const gc = compareRuntimeAllocationPlanWithGovernance(reports);
    expect(gc.aligned).toBe(false);
  });

  it("elevates drift when dry_run_candidate meets control_not_allowed", () => {
    const reports = trialInput({
      globalAllocationMode: "dry_run_candidate",
      boundary: "control_not_allowed",
    });
    const drift = evaluateRuntimeAllocationTrialDrift(reports);
    expect(drift.driftLevel).toBe("blocked");
    expect(drift.driftFindings.length).toBeGreaterThan(0);
  });

  it("serializes trial bundle without mutating source trial report", () => {
    const beforeTrial = trialInput({ globalAllocationMode: "planning_only" });
    const trial = buildRuntimeResourceTrialPlanningReports(beforeTrial);
    const withTrial = { ...beforeTrial, ...trial };
    const withCb = { ...withTrial, ...buildRuntimeControlBoundaryPlanningReports(withTrial) };
    const withEc = { ...withCb, ...buildRuntimeExecutionCandidatePlanningReports(withCb) };
    const full: RuntimeSemanticPlanningReports = {
      ...withEc,
      ...buildRuntimeOperatorApprovalPlanningReports(withEc),
    };
    const beforeMode = full.runtimeResourceAllocationTrialReport.trialMode;
    const ser = serializeRuntimeResourceTrialDiagnosticBundleFromSemanticReports(full);
    expect(ser.runtimeResourceAllocationTrialReport.actualTrialExecutionEnabled).toBe(false);
    expect(ser.runtimeAllocationForecastComparison.actualTrialExecutionEnabled).toBe(false);
    expect(ser.runtimeResourceAllocationTrialReport.trialMode).toBe(beforeMode);
  });

  it("keeps deterministic sorted observations in forecast comparison", () => {
    const reports = trialInput({ globalAllocationMode: "dry_run_candidate" });
    const a = compareRuntimeAllocationPlanWithForecast(reports).observations.join("\n");
    const b = compareRuntimeAllocationPlanWithForecast(reports).observations.join("\n");
    expect(a).toBe(b);
  });
});

describe("H22 integration with full semantic planning reports", () => {
  it("buildRuntimeResourceTrialPlanningReports matches evaluateRuntimeResourceAllocationTrial context wiring", () => {
    const baseline = evaluateHarnessMaturityBaseline({
      overlayExtract: null,
      harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
      recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
      messageExplainabilityAvailable: true,
    });
    const ctx = normalizeRuntimePlanningContext({
      overlay: null,
      maturityBaseline: baseline,
      releaseGate: evaluateHarnessReleaseGateReadiness(baseline),
      messageExplainabilityAvailable: true,
      overlayWarningCount: 0,
    });
    const dep = buildRuntimeDependencyPlanningReports(ctx);
    const crit = buildRuntimeCriticalityPlanningReports(ctx, dep);
    const trace = buildRuntimeTraceabilityPlanningReports(ctx, dep, crit);
    const reasoning = buildRuntimeReasoningPlanningReports(dep, crit, trace);
    const semantic = buildRuntimeSemanticPlanningReports(reasoning);

    const fc = semantic.runtimeAllocationForecastComparison;
    const gc = semantic.runtimeAllocationGovernanceComparison;
    const drift = semantic.runtimeAllocationTrialDriftSummary;
    const direct = evaluateRuntimeResourceAllocationTrial(semantic, {
      forecastComparison: fc,
      governanceComparison: gc,
      driftSummary: drift,
    });

    expect(direct.trialMode).toBe(semantic.runtimeResourceAllocationTrialReport.trialMode);
    expect(direct.consistency).toBe(semantic.runtimeResourceAllocationTrialReport.consistency);
    expect(direct.actualTrialExecutionEnabled).toBe(false);
  });
});
