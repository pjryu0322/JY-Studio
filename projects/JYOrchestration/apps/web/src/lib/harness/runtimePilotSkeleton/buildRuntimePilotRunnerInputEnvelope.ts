/**
 * H28 — runner **input envelope** metadata(read-only; payload 생성 없음).
 */

import type { RuntimeSemanticPlanningReportsBeforePilotSkeleton } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimePilotRunnerInputEnvelope } from "./runtimePilotSkeletonTypes";

export function buildRuntimePilotRunnerInputEnvelope(
  reports: RuntimeSemanticPlanningReportsBeforePilotSkeleton
): RuntimePilotRunnerInputEnvelope {
  const gate = reports.runtimePilotActivationFinalSafetyGate;
  const activation = reports.runtimePilotActivationSummary;
  const scope = reports.runtimePilotActivationScope;
  const policy = reports.runtimePilotActivationPolicy;
  const verification = reports.runtimePilotActivationReadinessVerificationReport;
  const boundary = reports.runtimePilotActivationBoundaryViolationReport;
  const sandboxPf = reports.runtimeAdapterSandboxPreflightSummary;
  const contract = reports.runtimePilotContractSummary;
  const noopPf = reports.runtimeNoopAdapterPreflightSummary;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;
  const control = reports.runtimeControlBoundarySummary;

  const envelopeRows = mergeSortedUniqueKo([
    `finalGateStatus:${gate.finalGateStatus}`,
    `h28EntryReadiness:${gate.h28EntryReadiness}`,
    `candidateStatus:${activation.candidateStatus}`,
    `activationMode:${activation.activationMode}`,
    `activationAllowedMode:${policy.activationAllowedMode}`,
    `readinessVerification:${verification.verificationStatus}`,
    `boundaryViolations:${boundary.actualFlagViolations.length}`,
    `sandboxPreflight:${sandboxPf.preflightReadiness}`,
    `contractReadiness:${contract.contractReadiness}`,
    `noopPreflight:${noopPf.preflightReadiness}`,
    `approvalReadiness:${approval.approvalReadiness}`,
    `rollbackReadiness:${rollback.rollbackReadiness}`,
    `auditReadiness:${audit.auditReadiness}`,
    `controlBoundaryRisk:${control.boundaryRisk}`,
    `scopeSource:${scope.candidateSourceLayer}`,
    "envelope:metadata_only",
    "actualRunnerExecution:false",
  ]);

  return {
    mode: "runtime_pilot_runner_input_envelope",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotActivationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    envelopeRows,
    recommendations: mergeSortedUniqueKo([
      "H28: runner input envelope — activation·sandbox·approval 메타 참조만(실행 없음)",
    ]),
  };
}
