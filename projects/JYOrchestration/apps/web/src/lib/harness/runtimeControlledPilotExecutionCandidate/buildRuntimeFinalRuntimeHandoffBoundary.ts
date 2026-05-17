/**
 * H45 — final runtime **handoff boundary** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  CONTROLLED_PILOT_EXECUTION_FORBIDDEN_OPERATIONS,
  RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
  RUNTIME_FINAL_RUNTIME_HANDOFF_BOUNDARY_SOURCE_LAYER,
  RUNTIME_FINAL_RUNTIME_HANDOFF_BOUNDARY_TARGET_LAYER,
} from "./runtimeControlledPilotExecutionCandidateConstants";
import { readControlledPilotExecutionUpstreamContext } from "./runtimeControlledPilotExecutionCandidateCheckHelpers";
import type { RuntimeFinalRuntimeHandoffBoundary } from "./runtimeControlledPilotExecutionCandidateTypes";

export function buildRuntimeFinalRuntimeHandoffBoundary(
  reports: RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate
): RuntimeFinalRuntimeHandoffBoundary {
  const { executionFinalGate } = readControlledPilotExecutionUpstreamContext(reports);

  return {
    mode: "runtime_final_runtime_handoff_boundary",
    ...RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
    boundarySourceLayer: RUNTIME_FINAL_RUNTIME_HANDOFF_BOUNDARY_SOURCE_LAYER,
    boundaryTargetLayer: RUNTIME_FINAL_RUNTIME_HANDOFF_BOUNDARY_TARGET_LAYER,
    requiredHandoffInputs: mergeSortedUniqueKo([
      "runtimePilotExecutionReadinessFinalSafetyGate",
      "runtimePilotExecutionReadinessSummary",
      "runtimePilotExecutionReadinessVerificationReport",
      "runtimePilotExecutionReadinessAlignmentReport",
      "runtimePilotExecutionReadinessViolationReport",
      "runtimePilotExecutionReadinessBoundary",
      "runtimeFinalPilotNoExecutionProof",
      "runtimeFinalPilotExecutionForbiddenProof",
      "runtimeLimitedPilotReadinessReviewFinalSafetyGate",
      "runtimeLimitedPilotBoundaryFinalSafetyGate",
      "runtimeOperatorApprovalSummary",
      "runtimeRollbackReadinessSummary",
      "runtimeAuditReadinessSummary",
    ]),
    expectedHandoffOutputs: mergeSortedUniqueKo([
      "runtimeControlledPilotExecutionCandidateSummary",
      "runtimeFinalRuntimeHandoffBoundary",
      "runtimeControlledPilotExecutionCandidateScope",
      "runtimeControlledPilotExecutionCandidatePolicy",
      `executionFinalGate:${executionFinalGate.finalGateStatus}`,
      `h45EntryReadiness:${executionFinalGate.h45EntryReadiness}`,
    ]),
    allowedHandoffMetadataScopes: mergeSortedUniqueKo([
      "controlled_pilot_execution_metadata_candidate",
      "controlled_pilot_execution_mode_metadata_only",
      "final_runtime_handoff_boundary",
      `h45EntryReadiness:${executionFinalGate.h45EntryReadiness}`,
    ]),
    forbiddenHandoffOperations: [...CONTROLLED_PILOT_EXECUTION_FORBIDDEN_OPERATIONS],
    recommendations: mergeSortedUniqueKo([
      "H45: final runtime handoff boundary — metadata only(실제 pilot activation·execution·runner·adapter·sandbox 없음)",
    ]),
  };
}
