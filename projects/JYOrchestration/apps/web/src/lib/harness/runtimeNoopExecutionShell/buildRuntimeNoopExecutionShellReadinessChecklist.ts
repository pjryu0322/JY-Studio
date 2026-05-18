/**
 * H31 — no-op execution shell **readiness checklist**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeNoopExecutionShell } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type {
  RuntimeNoopExecutionShellBlockerReport,
  RuntimeNoopExecutionShellReadinessChecklist,
} from "./runtimeNoopExecutionShellTypes";

export function buildRuntimeNoopExecutionShellReadinessChecklist(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeNoopExecutionShell;
  readonly blockerReport: RuntimeNoopExecutionShellBlockerReport;
}): RuntimeNoopExecutionShellReadinessChecklist {
  const { reports, blockerReport } = input;
  const harnessGate = reports.runtimeRunnerNoopHarnessFinalSafetyGate;
  const harnessVerification = reports.runtimeRunnerNoopHarnessReadinessVerificationReport;
  const harnessAlignment = reports.runtimeRunnerNoopHarnessAlignmentReport;
  const harnessBoundary = reports.runtimeRunnerNoopHarnessBoundaryViolationReport;
  const result = reports.runtimeRunnerNoopResultMetadata;
  const guard = reports.runtimeRunnerNoopHarnessSafetyGuard;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;

  const harnessFinalGateReady =
    harnessGate.finalGateStatus === "ready_metadata" && harnessGate.h31EntryReadiness === "ready_metadata";
  const harnessReadinessVerified = harnessVerification.verificationStatus === "verified_metadata";
  const harnessAlignmentAligned = harnessAlignment.alignmentStatus === "aligned_metadata";
  const noHarnessBoundaryViolations = harnessBoundary.actualFlagViolations.length === 0;
  const noShellBlockers = blockerReport.blockers.length === 0;
  const noopResultDiagnosticOnly = result.diagnosticOnly === true;
  const safetyGuardForbidsInvocation = guard.actualInvocationForbidden === true;
  const operatorApprovalReady =
    approval.approvalReadiness === "ready_for_review_metadata" || approval.approvalReadiness === "not_required";
  const rollbackReady =
    rollback.rollbackReadiness === "metadata_ready" || rollback.rollbackReadiness === "not_applicable";
  const auditSufficient =
    audit.auditReadiness === "sufficient_metadata" || audit.auditReadiness === "minimal";
  const actualShellExecutionDisabled = true;

  const rows: { readonly label: string; readonly ok: boolean }[] = [
    { label: "runner no-op harness final gate ready_metadata", ok: harnessFinalGateReady },
    { label: "h31 entry readiness ready_metadata", ok: harnessGate.h31EntryReadiness === "ready_metadata" },
    { label: "harness readiness verification verified_metadata", ok: harnessReadinessVerified },
    { label: "harness alignment aligned_metadata", ok: harnessAlignmentAligned },
    { label: "no harness boundary violations", ok: noHarnessBoundaryViolations },
    { label: "no shell blockers", ok: noShellBlockers },
    { label: "harness no-op result diagnosticOnly", ok: noopResultDiagnosticOnly },
    { label: "harness safety guard forbids invocation/execution", ok: safetyGuardForbidsInvocation },
    { label: "operator approval metadata ready", ok: operatorApprovalReady },
    { label: "rollback readiness metadata ready", ok: rollbackReady },
    { label: "audit readiness metadata sufficient", ok: auditSufficient },
    { label: "actual shell execution disabled", ok: actualShellExecutionDisabled },
  ];

  const checklist = mergeSortedUniqueKo(rows.map((r) => `${r.label}:${r.ok}`));
  const missingRows = mergeSortedUniqueKo(rows.filter((r) => !r.ok).map((r) => r.label));

  const blockers: string[] = [];
  if (!harnessFinalGateReady) {
    blockers.push("harness final gate not ready_metadata");
  }
  if (!harnessReadinessVerified) {
    blockers.push("harness readiness not verified_metadata");
  }
  if (!harnessAlignmentAligned) {
    blockers.push("harness alignment not aligned_metadata");
  }
  if (!noHarnessBoundaryViolations) {
    blockers.push("harness boundary violations present");
  }
  if (!noShellBlockers) {
    blockers.push(...blockerReport.blockers.slice(0, 2));
  }

  const recommendations = mergeSortedUniqueKo([
    ...(missingRows.length === 0
      ? ["H31: execution shell readiness checklist pass — isolated dry-run shell candidate(실행 없음)"]
      : ["H31: execution shell readiness checklist incomplete — harness·approval 정렬"]),
    ...blockerReport.recommendations,
  ]);

  return {
    mode: "runtime_noop_execution_shell_readiness_checklist",
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
    checklist,
    missingRows,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
