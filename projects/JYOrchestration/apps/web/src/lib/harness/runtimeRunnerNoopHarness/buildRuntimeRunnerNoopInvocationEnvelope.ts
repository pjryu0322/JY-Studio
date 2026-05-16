/**
 * H30 — runner **no-op invocation envelope** metadata(read-only; payload 생성 없음).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeRunnerNoopHarness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type { RuntimeRunnerNoopInvocationEnvelope } from "./runtimeRunnerNoopHarnessTypes";

export function buildRuntimeRunnerNoopInvocationEnvelope(
  reports: RuntimeSemanticPlanningReportsBeforeRunnerNoopHarness
): RuntimeRunnerNoopInvocationEnvelope {
  const gate = reports.runtimeRunnerInvocationFinalSafetyGate;
  const invocation = reports.runtimeRunnerInvocationSummary;
  const scope = reports.runtimeRunnerInvocationScope;
  const policy = reports.runtimeRunnerInvocationPolicy;
  const verification = reports.runtimeRunnerInvocationReadinessVerificationReport;
  const boundary = reports.runtimeRunnerInvocationBoundaryViolationReport;
  const skeletonPf = reports.runtimePilotSkeletonPreflightSummary;
  const contractVerification = reports.runtimePilotRunnerContractVerificationReport;
  const noExecution = reports.runtimePilotRunnerNoExecutionResultMetadata;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;
  const control = reports.runtimeControlBoundarySummary;

  const envelopeRows = mergeSortedUniqueKo([
    `finalGateStatus:${gate.finalGateStatus}`,
    `h30EntryReadiness:${gate.h30EntryReadiness}`,
    `candidateStatus:${invocation.candidateStatus}`,
    `invocationMode:${invocation.invocationMode}`,
    `invocationAllowedMode:${policy.invocationAllowedMode}`,
    `readinessVerification:${verification.verificationStatus}`,
    `boundaryViolations:${boundary.actualFlagViolations.length}`,
    `scopeSource:${scope.candidateSourceLayer}`,
    `scopeTarget:${scope.candidateTargetLayer}`,
    `skeletonPreflight:${skeletonPf.preflightReadiness}`,
    `runnerContractVerification:${contractVerification.verificationStatus}`,
    `noExecutionDiagnosticOnly:${noExecution.diagnosticOnly}`,
    `approvalReadiness:${approval.approvalReadiness}`,
    `rollbackReadiness:${rollback.rollbackReadiness}`,
    `auditReadiness:${audit.auditReadiness}`,
    `controlBoundaryRisk:${control.boundaryRisk}`,
    "envelope:metadata_only",
    "actualRunnerInvocation:false",
    "actualRunnerExecution:false",
  ]);

  return {
    mode: "runtime_runner_noop_invocation_envelope",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerInvocationEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerInvocationEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    envelopeRows,
    recommendations: mergeSortedUniqueKo([
      "H30: no-op invocation envelope — runner invocation·skeleton preflight 메타 참조만(invocation 없음)",
    ]),
  };
}
