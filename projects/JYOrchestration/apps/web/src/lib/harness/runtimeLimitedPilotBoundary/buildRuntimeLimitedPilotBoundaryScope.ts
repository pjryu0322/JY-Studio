/**
 * H42 — limited pilot boundary **scope** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeLimitedPilotBoundary } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  LIMITED_PILOT_BOUNDARY_SCOPE_SOURCE_LAYER,
  LIMITED_PILOT_BOUNDARY_SCOPE_TARGET_LAYER,
  LIMITED_PILOT_FORBIDDEN_OPERATIONS,
  RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED,
} from "./runtimeLimitedPilotBoundaryConstants";
import type { RuntimeLimitedPilotBoundaryScope } from "./runtimeLimitedPilotBoundaryTypes";

export function buildRuntimeLimitedPilotBoundaryScope(
  reports: RuntimeSemanticPlanningReportsBeforeLimitedPilotBoundary
): RuntimeLimitedPilotBoundaryScope {
  const activationFinalGate = reports.runtimeControlledActivationCandidateFinalSafetyGate;

  const requiredPilotBoundaryInputs = mergeSortedUniqueKo([
    "runtimeControlledActivationCandidateFinalSafetyGate",
    "runtimeControlledActivationCandidateSummary",
    "runtimeControlledActivationCandidatePolicy",
    "runtimeControlledActivationCandidateVerificationReport",
    "runtimeControlledActivationCandidateAlignmentReport",
    "runtimeControlledActivationCandidateViolationReport",
    "runtimeUltimateGovernanceReviewFinalSafetyGate",
    "runtimeFinalReleaseGovernanceGateFinalSafetyGate",
    "runtimeOperatorApprovalSummary",
    "runtimeRollbackReadinessSummary",
    "runtimeAuditReadinessSummary",
  ]);

  const expectedPilotBoundaryOutputs = mergeSortedUniqueKo([
    "runtimeLimitedPilotBoundarySummary",
    "runtimeLimitedPilotBoundaryScope",
    "runtimeLimitedPilotBoundaryPolicy",
    "runtimeLimitedPilotInputContract",
    "runtimeLimitedPilotOutputContract",
    "runtimeLimitedPilotBoundaryBlockerReport",
    "runtimeLimitedPilotReadinessChecklist",
    `activationFinalGate:${activationFinalGate.finalGateStatus}`,
    `h42EntryReadiness:${activationFinalGate.h42EntryReadiness}`,
  ]);

  return {
    mode: "runtime_limited_pilot_boundary_scope",
    ...RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED,
    candidateSourceLayer: LIMITED_PILOT_BOUNDARY_SCOPE_SOURCE_LAYER,
    candidateTargetLayer: LIMITED_PILOT_BOUNDARY_SCOPE_TARGET_LAYER,
    requiredPilotBoundaryInputs,
    expectedPilotBoundaryOutputs,
    allowedPilotBoundaryMetadataScopes: mergeSortedUniqueKo([
      "limited_pilot_boundary_metadata_candidate",
      "pilot_boundary_mode_metadata_only",
      `h42EntryReadiness:${activationFinalGate.h42EntryReadiness}`,
      "diagnosticBundleIncludesLimitedPilotBoundary:metadata",
    ]),
    forbiddenPilotBoundaryOperations: [...LIMITED_PILOT_FORBIDDEN_OPERATIONS],
    recommendations: mergeSortedUniqueKo([
      "H42: limited pilot boundary scope — metadata_only(실제 pilot activation·execution 없음)",
    ]),
  };
}
