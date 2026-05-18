/**
 * H38 — governance release-readiness **input envelope**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeGovernanceReleaseReadiness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type { RuntimeGovernanceReleaseInputEnvelope } from "./runtimeGovernanceReleaseReadinessTypes";

export function buildRuntimeGovernanceReleaseInputEnvelope(
  reports: RuntimeSemanticPlanningReportsBeforeGovernanceReleaseReadiness
): RuntimeGovernanceReleaseInputEnvelope {
  const governanceFinalGate = reports.runtimeExecutionGovernanceBoundaryFinalSafetyGate;
  const governanceSummary = reports.runtimeExecutionGovernanceBoundarySummary;
  const governancePolicy = reports.runtimeExecutionGovernanceBoundaryPolicy;
  const governanceReadiness = reports.runtimeExecutionGovernanceBoundaryReadinessVerificationReport;
  const governanceAlignment = reports.runtimeExecutionGovernanceBoundaryAlignmentReport;
  const governanceViolation = reports.runtimeExecutionGovernanceBoundaryViolationReport;
  const shellFinalGate = reports.runtimeExecutionBoundaryShellFinalSafetyGate;
  const preflightFinalGate = reports.runtimeReleaseGatePreflightFinalSafetyGate;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;
  const control = reports.runtimeControlBoundarySummary;

  const envelopeRows = mergeSortedUniqueKo([
    "runtimeExecutionGovernanceBoundaryFinalSafetyGate",
    "runtimeExecutionGovernanceBoundarySummary",
    "runtimeExecutionGovernanceBoundaryPolicy",
    "runtimeExecutionGovernanceBoundaryReadinessVerificationReport",
    "runtimeExecutionGovernanceBoundaryAlignmentReport",
    "runtimeExecutionGovernanceBoundaryViolationReport",
    "runtimeExecutionBoundaryShellFinalSafetyGate",
    "runtimeReleaseGatePreflightFinalSafetyGate",
    "runtimeOperatorApprovalSummary",
    "runtimeRollbackReadinessSummary",
    "runtimeAuditReadinessSummary",
    "runtimeControlBoundarySummary",
    `governanceFinalGateStatus:${governanceFinalGate.finalGateStatus}`,
    `h38EntryReadiness:${governanceFinalGate.h38EntryReadiness}`,
    `governanceCandidateStatus:${governanceSummary.candidateStatus}`,
    `governanceMode:${governanceSummary.governanceMode}`,
    `governanceReadinessVerification:${governanceReadiness.verificationStatus}`,
    `governanceAlignmentStatus:${governanceAlignment.alignmentStatus}`,
    `governanceBoundaryViolations:${governanceViolation.actualFlagViolations.length}`,
    `shellFinalGateStatus:${shellFinalGate.finalGateStatus}`,
    `preflightFinalGateStatus:${preflightFinalGate.finalGateStatus}`,
    `approvalReadiness:${approval.approvalReadiness}`,
    `rollbackReadiness:${rollback.rollbackReadiness}`,
    `auditReadiness:${audit.auditReadiness}`,
    `controlBoundaryRisk:${control.boundaryRisk}`,
    `governanceAllowedMode:${governancePolicy.governanceAllowedMode}`,
  ]);

  return {
    mode: "runtime_governance_release_input_envelope",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualReleaseEnforcementEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualExecutionRoutingEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    actualApprovalEnforcementEnabled: false,
    envelopeRows,
    recommendations: mergeSortedUniqueKo([
      "H38: governance release input envelope — metadata only(실제 release·approval enforcement payload 없음)",
    ]),
  };
}
