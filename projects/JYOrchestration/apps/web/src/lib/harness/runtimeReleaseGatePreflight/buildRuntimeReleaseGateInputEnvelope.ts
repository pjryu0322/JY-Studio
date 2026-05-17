/**
 * H35 — release-gate final preflight **input envelope**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeReleaseGatePreflight } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type { RuntimeReleaseGateInputEnvelope } from "./runtimeReleaseGatePreflightTypes";

export function buildRuntimeReleaseGateInputEnvelope(
  reports: RuntimeSemanticPlanningReportsBeforeReleaseGatePreflight
): RuntimeReleaseGateInputEnvelope {
  const finalGate = reports.runtimeNoopShellReleaseGateFinalSafetyGate;
  const releaseSummary = reports.runtimeNoopShellReleaseGateSummary;
  const policy = reports.runtimeNoopShellReleaseGatePolicy;
  const readinessVerification = reports.runtimeNoopShellReleaseGateReadinessVerificationReport;
  const alignment = reports.runtimeNoopShellReleaseGateAlignmentReport;
  const boundary = reports.runtimeNoopShellReleaseGateBoundaryViolationReport;
  const hardeningGate = reports.runtimeNoopShellHardeningFinalSafetyGate;
  const hardeningAlignment = reports.runtimeNoopShellHardeningAlignmentReport;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;
  const control = reports.runtimeControlBoundarySummary;

  const envelopeRows = mergeSortedUniqueKo([
    "runtimeNoopShellReleaseGateFinalSafetyGate",
    "runtimeNoopShellReleaseGateSummary",
    "runtimeNoopShellReleaseGatePolicy",
    "runtimeNoopShellReleaseGateReadinessVerificationReport",
    "runtimeNoopShellReleaseGateAlignmentReport",
    "runtimeNoopShellReleaseGateBoundaryViolationReport",
    "runtimeNoopShellHardeningFinalSafetyGate",
    "runtimeNoopShellHardeningAlignmentReport",
    "runtimeOperatorApprovalSummary",
    "runtimeRollbackReadinessSummary",
    "runtimeAuditReadinessSummary",
    "runtimeControlBoundarySummary",
    `finalGateStatus:${finalGate.finalGateStatus}`,
    `h35EntryReadiness:${finalGate.h35EntryReadiness}`,
    `candidateStatus:${releaseSummary.candidateStatus}`,
    `releaseGateMode:${releaseSummary.releaseGateMode}`,
    `readinessVerification:${readinessVerification.verificationStatus}`,
    `alignmentStatus:${alignment.alignmentStatus}`,
    `boundaryViolations:${boundary.actualFlagViolations.length}`,
    `hardeningFinalGate:${hardeningGate.finalGateStatus}`,
    `approvalReadiness:${approval.approvalReadiness}`,
    `rollbackReadiness:${rollback.rollbackReadiness}`,
    `auditReadiness:${audit.auditReadiness}`,
    `controlBoundaryRisk:${control.boundaryRisk}`,
    `releaseGateAllowedMode:${policy.releaseGateAllowedMode}`,
  ]);

  return {
    mode: "runtime_release_gate_input_envelope",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualReleaseEnforcementEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    envelopeRows,
    recommendations: mergeSortedUniqueKo([
      "H35: release-gate input envelope — metadata only(실제 release payload·execution payload 없음)",
    ]),
  };
}
