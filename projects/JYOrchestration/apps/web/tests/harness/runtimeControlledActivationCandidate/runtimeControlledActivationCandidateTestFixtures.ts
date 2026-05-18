import { buildRuntimeControlledActivationCandidatePlanningReports } from "@/lib/harness/runtimeControlledActivationCandidate/buildRuntimeControlledActivationCandidatePlanningReports";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type { RuntimeSemanticPlanningReportsBeforeControlledActivationCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { stripRuntimeControlledActivationCandidateLayer } from "../runtimePlanningReportStrip";
import { buildFullSemanticForUltimateGovernanceReview } from "../runtimeUltimateGovernanceReview/runtimeUltimateGovernanceReviewTestFixtures";

export function buildFullSemanticForControlledActivationCandidate() {
  return buildFullSemanticForUltimateGovernanceReview();
}

export function buildControlledActivationCandidateBaseReports() {
  return stripRuntimeControlledActivationCandidateLayer(buildFullSemanticForControlledActivationCandidate());
}

export function buildControlledActivationCandidatePlanning(
  patches: Partial<RuntimeSemanticPlanningReportsBeforeControlledActivationCandidate> = {}
) {
  return buildRuntimeControlledActivationCandidatePlanningReports({
    ...buildControlledActivationCandidateBaseReports(),
    ...patches,
  });
}

/** Upstream gates aligned; ultimate governance watch/partial for H41 watch candidate tests. */
export function buildControlledActivationWatchScenarioPatches(
  base: RuntimeSemanticPlanningReportsBeforeControlledActivationCandidate
): Partial<RuntimeSemanticPlanningReportsBeforeControlledActivationCandidate> {
  return {
    runtimeFinalReleaseGovernanceGateFinalSafetyGate: {
      ...base.runtimeFinalReleaseGovernanceGateFinalSafetyGate,
      finalGateStatus: "ready_metadata",
      h40EntryReadiness: "ready_metadata",
    },
    runtimeFinalReleaseGovernanceGateVerificationReport: {
      ...base.runtimeFinalReleaseGovernanceGateVerificationReport,
      verificationStatus: "verified_metadata",
    },
    runtimeFinalReleaseGovernanceGateAlignmentReport: {
      ...base.runtimeFinalReleaseGovernanceGateAlignmentReport,
      alignmentStatus: "aligned_metadata",
    },
    runtimeFinalReleaseGovernanceGateViolationReport: {
      ...base.runtimeFinalReleaseGovernanceGateViolationReport,
      actualFlagViolations: [],
      wordingRiskFindings: [],
    },
    runtimeGovernanceReleaseReadinessFinalSafetyGate: {
      ...base.runtimeGovernanceReleaseReadinessFinalSafetyGate,
      finalGateStatus: "ready_metadata",
      h39EntryReadiness: "ready_metadata",
    },
    runtimeGovernanceReleaseReadinessVerificationReport: {
      ...base.runtimeGovernanceReleaseReadinessVerificationReport,
      verificationStatus: "verified_metadata",
    },
    runtimeGovernanceReleaseReadinessAlignmentReport: {
      ...base.runtimeGovernanceReleaseReadinessAlignmentReport,
      alignmentStatus: "aligned_metadata",
    },
    runtimeGovernanceReleaseReadinessViolationReport: {
      ...base.runtimeGovernanceReleaseReadinessViolationReport,
      actualFlagViolations: [],
      proofViolations: [],
    },
    runtimeExecutionGovernanceBoundaryFinalSafetyGate: {
      ...base.runtimeExecutionGovernanceBoundaryFinalSafetyGate,
      finalGateStatus: "ready_metadata",
    },
    runtimeOperatorApprovalSummary: {
      ...base.runtimeOperatorApprovalSummary,
      approvalReadiness: "not_required",
    },
    runtimeRollbackReadinessSummary: {
      ...base.runtimeRollbackReadinessSummary,
      rollbackReadiness: "not_applicable",
    },
    runtimeAuditReadinessSummary: {
      ...base.runtimeAuditReadinessSummary,
      auditReadiness: "sufficient_metadata",
    },
    runtimeControlBoundarySummary: {
      ...base.runtimeControlBoundarySummary,
      boundaryRisk: "stable",
    },
    runtimeUltimateGovernanceReviewViolationReport: {
      ...base.runtimeUltimateGovernanceReviewViolationReport,
      actualFlagViolations: [],
      proofViolations: [],
      wordingRiskFindings: ["wording/flag risk: diagnosticOnly=false"],
    },
    runtimeUltimateGovernanceReviewFinalSafetyGate: {
      ...base.runtimeUltimateGovernanceReviewFinalSafetyGate,
      finalGateStatus: "watch",
      h41EntryReadiness: "watch",
    },
    runtimeUltimateGovernanceReviewVerificationReport: {
      ...base.runtimeUltimateGovernanceReviewVerificationReport,
      verificationStatus: "partial",
    },
    runtimeUltimateGovernanceReviewAlignmentReport: {
      ...base.runtimeUltimateGovernanceReviewAlignmentReport,
      alignmentStatus: "partial",
    },
    runtimeUltimateGovernanceReviewSummary: {
      ...base.runtimeUltimateGovernanceReviewSummary,
      reviewStatus: "watch",
      reviewBlockers: [],
    },
    runtimeUltimateGovernanceBlockerReport: {
      ...base.runtimeUltimateGovernanceBlockerReport,
      blockers: [],
    },
  };
}

export { buildRuntimeSemanticPlanningReports };
