/**
 * H33 — shell hardening **input envelope** metadata(read-only; payload 생성 없음).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeNoopShellHardening } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type { RuntimeNoopShellHardeningInputEnvelope } from "./runtimeNoopShellHardeningTypes";

export function buildRuntimeNoopShellHardeningInputEnvelope(
  reports: RuntimeSemanticPlanningReportsBeforeNoopShellHardening
): RuntimeNoopShellHardeningInputEnvelope {
  const gate = reports.runtimeNoopExecutionShellFinalSafetyGate;
  const shell = reports.runtimeNoopExecutionShellSummary;
  const scope = reports.runtimeNoopExecutionShellScope;
  const policy = reports.runtimeNoopExecutionShellPolicy;
  const verification = reports.runtimeNoopExecutionShellReadinessVerificationReport;
  const boundary = reports.runtimeNoopExecutionShellBoundaryViolationReport;
  const blockers = reports.runtimeNoopExecutionShellBlockerReport;
  const harnessSummary = reports.runtimeNoopExecutionShellHarnessSummary;
  const harnessPreflight = reports.runtimeNoopExecutionShellHarnessPreflightSummary;
  const contractBoundary = reports.runtimeNoopExecutionShellContractBoundary;
  const harnessGate = reports.runtimeRunnerNoopHarnessFinalSafetyGate;
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
    `shellBlockers:${blockers.blockers.length}`,
    `harnessPreflight:${harnessPreflight.preflightReadiness}`,
    `harnessReadiness:${harnessSummary.harnessReadiness}`,
    `contractBoundary:${contractBoundary.boundarySourceLayer}`,
    `scopeSource:${scope.candidateSourceLayer}`,
    `scopeTarget:${scope.candidateTargetLayer}`,
    `harnessFinalGate:${harnessGate.finalGateStatus}`,
    `approvalReadiness:${approval.approvalReadiness}`,
    `rollbackReadiness:${rollback.rollbackReadiness}`,
    `auditReadiness:${audit.auditReadiness}`,
    `controlBoundaryRisk:${control.boundaryRisk}`,
    "envelope:metadata_only",
    "actualNoopShellExecution:false",
    "actualExecutionShellExecution:false",
  ]);

  return {
    mode: "runtime_noop_shell_hardening_input_envelope",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    envelopeRows,
    recommendations: mergeSortedUniqueKo([
      "H33: shell hardening input envelope — execution shell·harness·contract boundary 메타 참조만(shell execution 없음)",
    ]),
  };
}
