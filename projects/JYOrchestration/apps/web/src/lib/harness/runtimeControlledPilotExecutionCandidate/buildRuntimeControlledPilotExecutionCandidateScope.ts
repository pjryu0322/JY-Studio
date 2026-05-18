/**
 * H45 — controlled pilot execution candidate **scope** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  CONTROLLED_PILOT_EXECUTION_CANDIDATE_SCOPE_SOURCE_LAYER,
  CONTROLLED_PILOT_EXECUTION_CANDIDATE_SCOPE_TARGET_LAYER,
  CONTROLLED_PILOT_EXECUTION_FORBIDDEN_OPERATIONS,
  RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
} from "./runtimeControlledPilotExecutionCandidateConstants";
import { readControlledPilotExecutionUpstreamContext } from "./runtimeControlledPilotExecutionCandidateCheckHelpers";
import type { RuntimeControlledPilotExecutionCandidateScope } from "./runtimeControlledPilotExecutionCandidateTypes";

export function buildRuntimeControlledPilotExecutionCandidateScope(
  reports: RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate
): RuntimeControlledPilotExecutionCandidateScope {
  const { executionFinalGate } = readControlledPilotExecutionUpstreamContext(reports);

  return {
    mode: "runtime_controlled_pilot_execution_candidate_scope",
    ...RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
    candidateSourceLayer: CONTROLLED_PILOT_EXECUTION_CANDIDATE_SCOPE_SOURCE_LAYER,
    candidateTargetLayer: CONTROLLED_PILOT_EXECUTION_CANDIDATE_SCOPE_TARGET_LAYER,
    requiredCandidateInputs: mergeSortedUniqueKo([
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
    expectedCandidateOutputs: mergeSortedUniqueKo([
      "runtimeControlledPilotExecutionCandidateSummary",
      "runtimeFinalRuntimeHandoffBoundary",
      "runtimeControlledPilotExecutionCandidateScope",
      "runtimeControlledPilotExecutionCandidatePolicy",
      "runtimeControlledPilotExecutionInputContract",
      "runtimeControlledPilotExecutionOutputContract",
      `executionFinalGate:${executionFinalGate.finalGateStatus}`,
      `h45EntryReadiness:${executionFinalGate.h45EntryReadiness}`,
    ]),
    allowedCandidateMetadataScopes: mergeSortedUniqueKo([
      "controlled_pilot_execution_metadata_candidate",
      "controlled_pilot_execution_mode_metadata_only",
      `h45EntryReadiness:${executionFinalGate.h45EntryReadiness}`,
      "diagnosticBundleIncludesControlledPilotExecutionCandidate:metadata",
    ]),
    forbiddenCandidateOperations: [...CONTROLLED_PILOT_EXECUTION_FORBIDDEN_OPERATIONS],
    recommendations: mergeSortedUniqueKo([
      "H45: controlled pilot execution candidate scope — metadata_only(실제 pilot·runner·adapter·sandbox·execution 없음)",
    ]),
  };
}
