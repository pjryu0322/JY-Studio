/**
 * H41 — controlled activation candidate **scope** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeControlledActivationCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  CONTROLLED_ACTIVATION_CANDIDATE_SCOPE_SOURCE_LAYER,
  CONTROLLED_ACTIVATION_CANDIDATE_SCOPE_TARGET_LAYER,
  CONTROLLED_ACTIVATION_FORBIDDEN_OPERATIONS,
  RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
} from "./runtimeControlledActivationCandidateConstants";
import type { RuntimeControlledActivationCandidateScope } from "./runtimeControlledActivationCandidateTypes";

export function buildRuntimeControlledActivationCandidateScope(
  reports: RuntimeSemanticPlanningReportsBeforeControlledActivationCandidate
): RuntimeControlledActivationCandidateScope {
  const ultimateFinalGate = reports.runtimeUltimateGovernanceReviewFinalSafetyGate;

  const requiredCandidateInputs = mergeSortedUniqueKo([
    "runtimeUltimateGovernanceReviewFinalSafetyGate",
    "runtimeUltimateGovernanceReviewSummary",
    "runtimeUltimateGovernanceReviewVerificationReport",
    "runtimeUltimateGovernanceReviewAlignmentReport",
    "runtimeUltimateGovernanceReviewViolationReport",
    "runtimeUltimateGovernanceBlockerReport",
    "runtimeFinalOrchestrationReadinessBoundary",
    "runtimeUltimateNoEnforcementProof",
    "runtimeOrchestrationForbiddenProof",
  ]);

  const expectedCandidateOutputs = mergeSortedUniqueKo([
    "runtimeControlledActivationCandidateSummary",
    "runtimeControlledActivationCandidateScope",
    "runtimeControlledActivationCandidatePolicy",
    "runtimeControlledActivationCandidateBlockerReport",
    "runtimeControlledActivationReadinessChecklist",
    `ultimateFinalGate:${ultimateFinalGate.finalGateStatus}`,
    `h41EntryReadiness:${ultimateFinalGate.h41EntryReadiness}`,
  ]);

  return {
    mode: "runtime_controlled_activation_candidate_scope",
    ...RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
    candidateSourceLayer: CONTROLLED_ACTIVATION_CANDIDATE_SCOPE_SOURCE_LAYER,
    candidateTargetLayer: CONTROLLED_ACTIVATION_CANDIDATE_SCOPE_TARGET_LAYER,
    requiredCandidateInputs,
    expectedCandidateOutputs,
    allowedCandidateMetadataScopes: mergeSortedUniqueKo([
      "controlled_activation_metadata_candidate",
      "controlled_activation_mode_metadata_only",
      `h41EntryReadiness:${ultimateFinalGate.h41EntryReadiness}`,
      "diagnosticBundleIncludesControlledActivationCandidate:metadata",
    ]),
    forbiddenCandidateOperations: [...CONTROLLED_ACTIVATION_FORBIDDEN_OPERATIONS],
    recommendations: mergeSortedUniqueKo([
      "H41: controlled activation candidate scope — metadata_only(실제 activation·orchestration 없음)",
    ]),
  };
}
