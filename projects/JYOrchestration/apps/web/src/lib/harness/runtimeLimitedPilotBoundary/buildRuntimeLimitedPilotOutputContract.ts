/**
 * H42 — limited pilot **output contract** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeLimitedPilotBoundaryBlockerReport,
  RuntimeLimitedPilotBoundaryPolicy,
  RuntimeLimitedPilotBoundarySummary,
  RuntimeLimitedPilotOutputContract,
  RuntimeLimitedPilotReadinessChecklist,
} from "./runtimeLimitedPilotBoundaryTypes";
import { RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED } from "./runtimeLimitedPilotBoundaryConstants";

export function buildRuntimeLimitedPilotOutputContract(input: {
  readonly summary: RuntimeLimitedPilotBoundarySummary;
  readonly policy: RuntimeLimitedPilotBoundaryPolicy;
  readonly blockerReport: RuntimeLimitedPilotBoundaryBlockerReport;
  readonly checklist: RuntimeLimitedPilotReadinessChecklist;
}): RuntimeLimitedPilotOutputContract {
  const { summary, policy, blockerReport, checklist } = input;

  const contractRows = mergeSortedUniqueKo([
    `pilotBoundaryCandidateStatus:${summary.candidateStatus}`,
    `pilotBoundaryMode:${summary.pilotBoundaryMode}`,
    `pilotBoundaryAccepted:${summary.candidateStatus === "limited_pilot_boundary_metadata_candidate"}`,
    `pilotBoundaryRejected:${summary.candidateStatus === "blocked"}`,
    "pilotBoundaryReadinessMetadata",
    "pilotBoundaryPolicyMetadata",
    "pilotBoundaryBlockerMetadata",
    "pilotBoundaryChecklistMetadata",
    "auditTraceMetadata",
    `policyAllowedMode:${policy.pilotBoundaryAllowedMode}`,
    `blockers:${blockerReport.blockers.length}`,
    `checklistMissing:${checklist.missingRows.length}`,
  ]);

  return {
    mode: "runtime_limited_pilot_output_contract",
    ...RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED,
    contractRows,
    recommendations: mergeSortedUniqueKo([
      "H42: limited pilot output contract — boundary metadata만(실제 pilot 수행 없음)",
    ]),
  };
}
