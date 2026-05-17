/**
 * H45 — controlled pilot execution **output contract** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeControlledPilotExecutionCandidateBlockerReport,
  RuntimeControlledPilotExecutionCandidatePolicy,
  RuntimeControlledPilotExecutionCandidateSummary,
  RuntimeControlledPilotExecutionOutputContract,
  RuntimeControlledPilotExecutionReadinessChecklist,
} from "./runtimeControlledPilotExecutionCandidateTypes";
import { RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED } from "./runtimeControlledPilotExecutionCandidateConstants";

export function buildRuntimeControlledPilotExecutionOutputContract(input: {
  readonly summary: RuntimeControlledPilotExecutionCandidateSummary;
  readonly policy: RuntimeControlledPilotExecutionCandidatePolicy;
  readonly blockerReport: RuntimeControlledPilotExecutionCandidateBlockerReport;
  readonly checklist: RuntimeControlledPilotExecutionReadinessChecklist;
}): RuntimeControlledPilotExecutionOutputContract {
  const { summary, policy, blockerReport, checklist } = input;

  const contractRows = mergeSortedUniqueKo([
    `controlledPilotExecutionCandidateStatus:${summary.candidateStatus}`,
    `controlledPilotExecutionMode:${summary.executionMode}`,
    `candidateAccepted:${summary.candidateStatus === "controlled_pilot_execution_metadata_candidate"}`,
    `candidateRejected:${summary.candidateStatus === "blocked"}`,
    "controlledPilotExecutionCandidateMetadata",
    "finalRuntimeHandoffBoundaryMetadata",
    "controlledPilotExecutionPolicyMetadata",
    "controlledPilotExecutionBlockerMetadata",
    "controlledPilotExecutionReadinessChecklistMetadata",
    "auditTraceMetadata",
    `policyAllowedMode:${policy.executionAllowedMode}`,
    `blockers:${blockerReport.blockers.length}`,
    `checklistMissing:${checklist.missingRows.length}`,
  ]);

  return {
    mode: "runtime_controlled_pilot_execution_output_contract",
    ...RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
    contractRows,
    recommendations: mergeSortedUniqueKo([
      "H45: controlled pilot execution output contract — candidate·handoff metadata만(실제 pilot·runner·execution 없음)",
    ]),
  };
}
