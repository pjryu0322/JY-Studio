/**
 * H23 — execution candidate **차단 후보** 목록(read-only; report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReportsBeforeExecutionCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "./runtimeExecutionCandidateMerge";

export function detectRuntimeExecutionCandidateBlockers(
  reports: RuntimeSemanticPlanningReportsBeforeExecutionCandidate
): readonly string[] {
  const out: string[] = [];
  const v = reports.runtimeControlBoundaryViolationReport;
  const b = reports.runtimeControlBoundarySummary;
  const drift = reports.runtimeAllocationTrialDriftSummary;
  const trial = reports.runtimeResourceAllocationTrialReport;
  const gov = reports.runtimeResourceGovernanceSummary;

  for (const row of v.actualFlagViolations) {
    out.push(`actual flag violation: ${row}`);
  }
  for (const row of v.wordingRiskFindings) {
    out.push(`wording risk: ${row}`);
  }
  if (b.boundaryLevel === "actual_control_forbidden") {
    out.push("control boundary: actual_control_forbidden");
  }
  if (b.boundaryRisk === "blocked") {
    out.push("control boundary risk: blocked");
  }
  if (drift.driftLevel === "blocked") {
    out.push("trial drift: blocked");
  }
  if (trial.consistency === "blocked") {
    out.push("trial consistency: blocked");
  }
  if (gov.governanceRisk === "critical_candidate") {
    out.push("governance risk: critical_candidate");
  }
  if (
    gov.operatorReviewRequirement === "required" &&
    (gov.allocationReadiness === "not_ready" || gov.allocationReadiness === "planning_metadata_only")
  ) {
    out.push("operator review: required but allocation readiness unresolved(메타)");
  }
  if (gov.allocationReadiness === "trial_signal_blocked") {
    out.push("rollback readiness: trial_signal_blocked(메타)");
  }
  return mergeSortedUniqueKo(out);
}
