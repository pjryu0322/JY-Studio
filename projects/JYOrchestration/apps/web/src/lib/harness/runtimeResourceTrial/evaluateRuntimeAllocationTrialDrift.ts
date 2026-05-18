/**
 * H22 — allocation plan vs resource/governance/forecast/decision **drift** 요약(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeTrial } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type { RuntimeAllocationTrialDriftSummary, RuntimeTrialDriftLevel } from "./runtimeResourceTrialTypes";

export function evaluateRuntimeAllocationTrialDrift(
  reports: RuntimeSemanticPlanningReportsBeforeTrial
): RuntimeAllocationTrialDriftSummary {
  const plan = reports.runtimeResourceAllocationPlan;
  const boundary = reports.runtimeResourceControlBoundary.boundary;
  const findings: string[] = [];

  if (plan.globalAllocationMode === "dry_run_candidate" && boundary === "control_not_allowed") {
    findings.push("drift: dry_run_candidate allocation 신호인데 control boundary는 control_not_allowed");
  }

  const workloadById = new Map(reports.runtimeMemberWorkload.members.map((m) => [m.memberId, m]));
  let saturatedOrElevated = 0;
  for (const mp of plan.memberPlans) {
    const w = workloadById.get(mp.memberId);
    if (w && (w.workloadLevel === "saturated" || w.workloadLevel === "elevated")) saturatedOrElevated += 1;
  }
  if (plan.globalAllocationMode === "planning_only" && saturatedOrElevated >= 2) {
    findings.push("drift: planning_only인데 saturated/elevated 멤버 과다");
  }

  const provSev = reports.runtimeResourceSummary.providerPressure.severity;
  if (plan.globalAllocationMode === "not_needed" && (provSev === "high" || provSev === "critical_candidate")) {
    findings.push("drift: not_needed인데 provider pressure high/critical");
  }

  const coherence = reports.runtimeDecisionCoherence.overallLevel;
  if (plan.globalAllocationMode === "dry_run_candidate" && coherence === "divergent") {
    findings.push("drift: dry_run_candidate allocation인데 decision coherence divergent");
  }

  findings.sort((a, b) => a.localeCompare(b, "ko"));

  let driftLevel: RuntimeTrialDriftLevel = "none";
  if (findings.some((f) => f.includes("control_not_allowed"))) driftLevel = "blocked";
  else if (findings.length >= 2) driftLevel = "elevated";
  else if (findings.length === 1) driftLevel = "watch";

  return {
    mode: "runtime_allocation_trial_drift_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualResourceAllocationEnabled: false,
    actualTrialExecutionEnabled: false,
    driftLevel,
    driftFindings: findings,
  };
}
