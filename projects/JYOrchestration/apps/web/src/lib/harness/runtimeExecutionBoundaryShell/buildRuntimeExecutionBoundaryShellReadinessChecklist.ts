/**
 * H36 — execution boundary shell **readiness checklist**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { isRuntimeReleaseGateOperationForbiddenProofComplete } from "@/lib/harness/runtimeReleaseGatePreflight/buildRuntimeReleaseGateOperationForbiddenProof";
import type { RuntimeSemanticPlanningReportsBeforeExecutionBoundaryShell } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type {
  RuntimeExecutionBoundaryShellBlockerReport,
  RuntimeExecutionBoundaryShellReadinessChecklist,
} from "./runtimeExecutionBoundaryShellTypes";

export function buildRuntimeExecutionBoundaryShellReadinessChecklist(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeExecutionBoundaryShell;
  readonly blockerReport: RuntimeExecutionBoundaryShellBlockerReport;
}): RuntimeExecutionBoundaryShellReadinessChecklist {
  const { reports, blockerReport } = input;
  const preflightFinalGate = reports.runtimeReleaseGatePreflightFinalSafetyGate;
  const readinessVerification = reports.runtimeReleaseGatePreflightReadinessVerificationReport;
  const alignment = reports.runtimeReleaseGatePreflightAlignmentReport;
  const boundaryViolation = reports.runtimeReleaseGatePreflightBoundaryViolationReport;
  const noExecutionProof = reports.runtimeReleaseGateNoExecutionProof;
  const operationForbiddenProof = reports.runtimeReleaseGateOperationForbiddenProof;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;

  const preflightFinalGateReady =
    preflightFinalGate.finalGateStatus === "ready_metadata" && preflightFinalGate.h36EntryReadiness === "ready_metadata";
  const preflightReadinessVerified = readinessVerification.verificationStatus === "verified_metadata";
  const preflightAlignmentAligned = alignment.alignmentStatus === "aligned_metadata";
  const noPreflightBoundaryViolations = boundaryViolation.actualFlagViolations.length === 0;
  const noPreflightProofViolations = boundaryViolation.proofViolations.length === 0;
  const noBoundaryShellBlockers = blockerReport.blockers.length === 0;
  const noExecutionDiagnosticOnly = noExecutionProof.diagnosticOnly === true;
  const operationForbiddenComplete = isRuntimeReleaseGateOperationForbiddenProofComplete(operationForbiddenProof);
  const operatorApprovalReady =
    approval.approvalReadiness === "ready_for_review_metadata" || approval.approvalReadiness === "not_required";
  const rollbackReady =
    rollback.rollbackReadiness === "metadata_ready" || rollback.rollbackReadiness === "not_applicable";
  const auditSufficient = audit.auditReadiness === "sufficient_metadata" || audit.auditReadiness === "minimal";
  const actualExecutionDisabled = true;
  const actualReleaseEnforcementDisabled = true;
  const actualShellExecutionDisabled = true;

  const rows: { readonly label: string; readonly ok: boolean }[] = [
    { label: "release-gate preflight final gate ready_metadata", ok: preflightFinalGateReady },
    { label: "h36 entry readiness ready_metadata", ok: preflightFinalGate.h36EntryReadiness === "ready_metadata" },
    { label: "preflight readiness verification verified_metadata", ok: preflightReadinessVerified },
    { label: "preflight alignment aligned_metadata", ok: preflightAlignmentAligned },
    { label: "no preflight boundary violations", ok: noPreflightBoundaryViolations },
    { label: "no preflight proof violations", ok: noPreflightProofViolations },
    { label: "no boundary shell blockers", ok: noBoundaryShellBlockers },
    { label: "no-execution proof diagnosticOnly", ok: noExecutionDiagnosticOnly },
    { label: "operation-forbidden proof complete", ok: operationForbiddenComplete },
    { label: "operator approval metadata ready", ok: operatorApprovalReady },
    { label: "rollback readiness metadata ready", ok: rollbackReady },
    { label: "audit readiness metadata sufficient", ok: auditSufficient },
    { label: "actual execution disabled", ok: actualExecutionDisabled },
    { label: "actual release enforcement disabled", ok: actualReleaseEnforcementDisabled },
    { label: "actual shell execution disabled", ok: actualShellExecutionDisabled },
  ];

  const checklist = mergeSortedUniqueKo(rows.map((r) => `${r.label}:${r.ok}`));
  const missingRows = mergeSortedUniqueKo(rows.filter((r) => !r.ok).map((r) => r.label));

  const blockers: string[] = [];
  if (!preflightFinalGateReady) blockers.push("preflight final gate not ready_metadata");
  if (!preflightReadinessVerified) blockers.push("preflight readiness not verified_metadata");
  if (!preflightAlignmentAligned) blockers.push("preflight alignment not aligned_metadata");
  if (!noPreflightProofViolations) blockers.push("preflight proof violations present");
  if (!noExecutionDiagnosticOnly) blockers.push("no-execution proof not diagnosticOnly");
  if (!operationForbiddenComplete) blockers.push("operation-forbidden proof incomplete");
  if (!noBoundaryShellBlockers) blockers.push(...blockerReport.blockers.slice(0, 2));

  const recommendations = mergeSortedUniqueKo([
    ...(missingRows.length === 0
      ? ["H36: execution boundary shell checklist pass — metadata shell candidate(집행 없음)"]
      : ["H36: execution boundary shell checklist incomplete — preflight final gate·proof 정렬"]),
    ...blockerReport.recommendations,
  ]);

  return {
    mode: "runtime_execution_boundary_shell_readiness_checklist",
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
    checklist,
    missingRows,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
