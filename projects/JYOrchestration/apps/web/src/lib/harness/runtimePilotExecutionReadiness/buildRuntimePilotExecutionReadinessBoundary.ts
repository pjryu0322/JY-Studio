/**
 * H44 — pilot execution readiness **boundary** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforePilotExecutionReadiness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  PILOT_EXECUTION_READINESS_BOUNDARY_SOURCE_LAYER,
  PILOT_EXECUTION_READINESS_BOUNDARY_TARGET_LAYER,
  PILOT_EXECUTION_READINESS_FORBIDDEN_BOUNDARY_OPERATIONS,
  RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED,
} from "./runtimePilotExecutionReadinessConstants";
import type { RuntimePilotExecutionReadinessBoundary } from "./runtimePilotExecutionReadinessTypes";

export function buildRuntimePilotExecutionReadinessBoundary(
  reports: RuntimeSemanticPlanningReportsBeforePilotExecutionReadiness
): RuntimePilotExecutionReadinessBoundary {
  const reviewFinalGate = reports.runtimeLimitedPilotReadinessReviewFinalSafetyGate;

  return {
    mode: "runtime_pilot_execution_readiness_boundary",
    ...RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED,
    boundarySourceLayer: PILOT_EXECUTION_READINESS_BOUNDARY_SOURCE_LAYER,
    boundaryTargetLayer: PILOT_EXECUTION_READINESS_BOUNDARY_TARGET_LAYER,
    requiredBoundaryInputs: mergeSortedUniqueKo([
      "runtimeLimitedPilotReadinessReviewFinalSafetyGate",
      "runtimeLimitedPilotReadinessReviewSummary",
      "runtimeLimitedPilotReadinessReviewVerificationReport",
      "runtimeLimitedPilotReadinessReviewAlignmentReport",
      "runtimeLimitedPilotReadinessReviewViolationReport",
      "runtimePilotContractHardeningBoundary",
      "runtimePilotNoExecutionProof",
      "runtimePilotExecutionForbiddenProof",
      "runtimeLimitedPilotBoundaryFinalSafetyGate",
      "runtimeControlledActivationCandidateFinalSafetyGate",
      "runtimeOperatorApprovalSummary",
      "runtimeRollbackReadinessSummary",
      "runtimeAuditReadinessSummary",
    ]),
    expectedBoundaryOutputs: mergeSortedUniqueKo([
      "runtimePilotExecutionReadinessSummary",
      "runtimePilotExecutionReadinessBoundary",
      "runtimePilotExecutionReadinessInputEnvelope",
      "runtimePilotExecutionReadinessOutputEnvelope",
      `reviewFinalGate:${reviewFinalGate.finalGateStatus}`,
      `h44EntryReadiness:${reviewFinalGate.h44EntryReadiness}`,
    ]),
    allowedBoundaryScopes: mergeSortedUniqueKo([
      "pilot_execution_readiness_status",
      "pilot_execution_readiness_metadata_only",
      "final_pilot_no_execution_proof",
      "final_pilot_execution_forbidden_proof",
      `h44EntryReadiness:${reviewFinalGate.h44EntryReadiness}`,
    ]),
    forbiddenBoundaryOperations: [...PILOT_EXECUTION_READINESS_FORBIDDEN_BOUNDARY_OPERATIONS],
    recommendations: mergeSortedUniqueKo([
      "H44: pilot execution readiness boundary — metadata only(실제 pilot activation·execution·runner·adapter·sandbox 없음)",
    ]),
  };
}
