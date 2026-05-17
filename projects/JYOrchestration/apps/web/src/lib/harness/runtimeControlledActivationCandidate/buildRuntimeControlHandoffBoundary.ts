/**
 * H41 — runtime control **handoff boundary** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeControlledActivationCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  CONTROLLED_ACTIVATION_FORBIDDEN_OPERATIONS,
  RUNTIME_CONTROL_HANDOFF_BOUNDARY_SOURCE_LAYER,
  RUNTIME_CONTROL_HANDOFF_BOUNDARY_TARGET_LAYER,
  RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
} from "./runtimeControlledActivationCandidateConstants";
import type { RuntimeControlHandoffBoundary } from "./runtimeControlledActivationCandidateTypes";

export function buildRuntimeControlHandoffBoundary(
  reports: RuntimeSemanticPlanningReportsBeforeControlledActivationCandidate
): RuntimeControlHandoffBoundary {
  const ultimateFinalGate = reports.runtimeUltimateGovernanceReviewFinalSafetyGate;

  return {
    mode: "runtime_control_handoff_boundary",
    ...RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
    boundarySourceLayer: RUNTIME_CONTROL_HANDOFF_BOUNDARY_SOURCE_LAYER,
    boundaryTargetLayer: RUNTIME_CONTROL_HANDOFF_BOUNDARY_TARGET_LAYER,
    requiredInputMetadata: mergeSortedUniqueKo([
      "runtimeUltimateGovernanceReviewFinalSafetyGate",
      "runtimeUltimateGovernanceReviewSummary",
      "runtimeUltimateGovernanceReviewVerificationReport",
      "runtimeUltimateGovernanceReviewAlignmentReport",
      "runtimeUltimateGovernanceReviewViolationReport",
      "runtimeFinalOrchestrationReadinessBoundary",
      "runtimeUltimateNoEnforcementProof",
      "runtimeOrchestrationForbiddenProof",
    ]),
    expectedOutputMetadata: mergeSortedUniqueKo([
      "runtimeControlledActivationCandidateSummary",
      "runtimeControlHandoffBoundary",
      "runtimeControlledActivationCandidateScope",
      "runtimeControlledActivationCandidatePolicy",
      `ultimateFinalGate:${ultimateFinalGate.finalGateStatus}`,
      `h41EntryReadiness:${ultimateFinalGate.h41EntryReadiness}`,
    ]),
    allowedHandoffMetadataScopes: mergeSortedUniqueKo([
      "controlled_activation_candidate_status",
      "controlled_activation_mode_metadata_only",
      "runtime_control_handoff_boundary",
      `h41EntryReadiness:${ultimateFinalGate.h41EntryReadiness}`,
    ]),
    forbiddenHandoffOperations: [...CONTROLLED_ACTIVATION_FORBIDDEN_OPERATIONS],
    recommendations: mergeSortedUniqueKo([
      "H41: runtime control handoff boundary — metadata only(실제 activation·orchestration·execution 없음)",
    ]),
  };
}
