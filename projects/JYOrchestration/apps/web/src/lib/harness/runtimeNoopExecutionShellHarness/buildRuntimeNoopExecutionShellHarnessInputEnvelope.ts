/**
 * H32 — execution shell harness **input envelope** metadata(read-only; payload 생성 없음).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeNoopExecutionShellHarness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type { RuntimeNoopExecutionShellHarnessInputEnvelope } from "./runtimeNoopExecutionShellHarnessTypes";

export function buildRuntimeNoopExecutionShellHarnessInputEnvelope(
  reports: RuntimeSemanticPlanningReportsBeforeNoopExecutionShellHarness
): RuntimeNoopExecutionShellHarnessInputEnvelope {
  const gate = reports.runtimeNoopExecutionShellFinalSafetyGate;
  const shell = reports.runtimeNoopExecutionShellSummary;
  const scope = reports.runtimeNoopExecutionShellScope;
  const policy = reports.runtimeNoopExecutionShellPolicy;
  const verification = reports.runtimeNoopExecutionShellReadinessVerificationReport;
  const boundary = reports.runtimeNoopExecutionShellBoundaryViolationReport;
  const harnessGate = reports.runtimeRunnerNoopHarnessFinalSafetyGate;
  const harnessAlignment = reports.runtimeRunnerNoopHarnessAlignmentReport;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;
  const control = reports.runtimeControlBoundarySummary;

  const envelopeRows = mergeSortedUniqueKo([
    `finalGateStatus:${gate.finalGateStatus}`,
    `h32EntryReadiness:${gate.h32EntryReadiness}`,
    `candidateStatus:${shell.candidateStatus}`,
    `shellMode:${shell.shellMode}`,
    `shellAllowedMode:${policy.shellAllowedMode}`,
    `readinessVerification:${verification.verificationStatus}`,
    `boundaryViolations:${boundary.actualFlagViolations.length}`,
    `harnessFinalGate:${harnessGate.finalGateStatus}`,
    `harnessAlignment:${harnessAlignment.alignmentStatus}`,
    `approvalReadiness:${approval.approvalReadiness}`,
    `rollbackReadiness:${rollback.rollbackReadiness}`,
    `auditReadiness:${audit.auditReadiness}`,
    `controlBoundaryRisk:${control.boundaryRisk}`,
    `scopeSource:${scope.candidateSourceLayer}`,
    `scopeTarget:${scope.candidateTargetLayer}`,
    "envelope:metadata_only",
    "actualNoopShellExecution:false",
    "actualExecutionShellExecution:false",
  ]);

  return {
    mode: "runtime_noop_execution_shell_harness_input_envelope",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerInvocationEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerInvocationEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    envelopeRows,
    recommendations: mergeSortedUniqueKo([
      "H32: execution shell harness input envelope — execution shell·harness final gate 메타 참조만(shell execution 없음)",
    ]),
  };
}
