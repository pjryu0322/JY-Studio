/**
 * H35 — release-gate final preflight **checklist**(read-only; H36 entry).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeReleaseGatePreflight } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { isRuntimeReleaseGateOperationForbiddenProofComplete } from "./buildRuntimeReleaseGateOperationForbiddenProof";
import type {
  RuntimeReleaseGateNoExecutionProof,
  RuntimeReleaseGateOperationForbiddenProof,
  RuntimeReleaseGatePreflightBlockerReport,
  RuntimeReleaseGatePreflightChecklist,
} from "./runtimeReleaseGatePreflightTypes";

export function buildRuntimeReleaseGatePreflightChecklist(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeReleaseGatePreflight;
  readonly blockerReport: RuntimeReleaseGatePreflightBlockerReport;
  readonly noExecutionProof: RuntimeReleaseGateNoExecutionProof;
  readonly operationForbiddenProof: RuntimeReleaseGateOperationForbiddenProof;
}): RuntimeReleaseGatePreflightChecklist {
  const { reports, blockerReport, noExecutionProof, operationForbiddenProof } = input;
  const finalGate = reports.runtimeNoopShellReleaseGateFinalSafetyGate;
  const readinessVerification = reports.runtimeNoopShellReleaseGateReadinessVerificationReport;
  const alignment = reports.runtimeNoopShellReleaseGateAlignmentReport;
  const boundary = reports.runtimeNoopShellReleaseGateBoundaryViolationReport;
  const releaseBlockers = reports.runtimeNoopShellReleaseGateBlockerReport;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;

  const finalGateReady =
    finalGate.finalGateStatus === "ready_metadata" && finalGate.h35EntryReadiness === "ready_metadata";
  const readinessVerified = readinessVerification.verificationStatus === "verified_metadata";
  const alignmentAligned = alignment.alignmentStatus === "aligned_metadata";
  const noBoundaryViolations = boundary.actualFlagViolations.length === 0;
  const noPreflightBlockers = blockerReport.blockers.length === 0;
  const noExecutionDiagnosticOnly = noExecutionProof.diagnosticOnly === true;
  const operationForbiddenComplete = isRuntimeReleaseGateOperationForbiddenProofComplete(operationForbiddenProof);
  const operatorApprovalReady =
    approval.approvalReadiness === "ready_for_review_metadata" || approval.approvalReadiness === "not_required";
  const rollbackReady =
    rollback.rollbackReadiness === "metadata_ready" || rollback.rollbackReadiness === "not_applicable";
  const auditSufficient = audit.auditReadiness === "sufficient_metadata" || audit.auditReadiness === "minimal";
  const actualReleaseEnforcementDisabled = true;
  const actualShellExecutionDisabled = true;
  const actualExecutionDisabled = true;

  const rows: { readonly label: string; readonly ok: boolean }[] = [
    { label: "release-gate final safety gate ready_metadata", ok: finalGateReady },
    { label: "h35 entry readiness ready_metadata", ok: finalGate.h35EntryReadiness === "ready_metadata" },
    { label: "release-gate readiness verification verified_metadata", ok: readinessVerified },
    { label: "release-gate alignment aligned_metadata", ok: alignmentAligned },
    { label: "no release-gate boundary violations", ok: noBoundaryViolations },
    { label: "no preflight blockers", ok: noPreflightBlockers && releaseBlockers.blockers.length === 0 },
    { label: "no-execution proof diagnosticOnly", ok: noExecutionDiagnosticOnly },
    { label: "operation-forbidden proof complete", ok: operationForbiddenComplete },
    { label: "operator approval metadata ready", ok: operatorApprovalReady },
    { label: "rollback readiness metadata ready", ok: rollbackReady },
    { label: "audit readiness metadata sufficient", ok: auditSufficient },
    { label: "actual release enforcement disabled", ok: actualReleaseEnforcementDisabled },
    { label: "actual shell execution disabled", ok: actualShellExecutionDisabled },
    { label: "actual execution disabled", ok: actualExecutionDisabled },
    {
      label: "h36 entry readiness preflight_metadata_ready",
      ok: finalGateReady && readinessVerified && alignmentAligned && noBoundaryViolations && noPreflightBlockers,
    },
  ];

  const checklist = mergeSortedUniqueKo(rows.map((r) => `${r.label}:${r.ok}`));
  const missingRows = mergeSortedUniqueKo(rows.filter((r) => !r.ok).map((r) => r.label));

  const blockers: string[] = [];
  if (!finalGateReady) blockers.push("release-gate final gate not ready_metadata");
  if (!readinessVerified) blockers.push("release-gate readiness not verified_metadata");
  if (!alignmentAligned) blockers.push("release-gate alignment not aligned_metadata");
  if (!noExecutionDiagnosticOnly) blockers.push("no-execution proof not diagnosticOnly");
  if (!operationForbiddenComplete) blockers.push("operation-forbidden proof incomplete");
  if (!noPreflightBlockers) blockers.push(...blockerReport.blockers.slice(0, 2));

  const recommendations = mergeSortedUniqueKo([
    ...(missingRows.length === 0
      ? ["H35: release-gate preflight checklist pass — H36 entry boundary 후보(집행 없음)"]
      : ["H35: release-gate preflight checklist incomplete — final gate·proof 정렬"]),
    ...blockerReport.recommendations,
  ]);

  return {
    mode: "runtime_release_gate_preflight_checklist",
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
