/**
 * H44 — pilot execution readiness **checklist**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforePilotExecutionReadiness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  isRuntimeFinalPilotExecutionForbiddenProofComplete,
  isRuntimeFinalPilotNoExecutionProofValid,
} from "./runtimePilotExecutionReadinessCheckHelpers";
import { RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED } from "./runtimePilotExecutionReadinessConstants";
import type {
  RuntimeFinalPilotExecutionForbiddenProof,
  RuntimeFinalPilotNoExecutionProof,
  RuntimePilotExecutionReadinessBlockerReport,
  RuntimePilotExecutionReadinessChecklist,
} from "./runtimePilotExecutionReadinessTypes";

export function buildRuntimePilotExecutionReadinessChecklist(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforePilotExecutionReadiness;
  readonly blockerReport: RuntimePilotExecutionReadinessBlockerReport;
  readonly noExecutionProof: RuntimeFinalPilotNoExecutionProof;
  readonly forbiddenProof: RuntimeFinalPilotExecutionForbiddenProof;
}): RuntimePilotExecutionReadinessChecklist {
  const { reports, blockerReport, noExecutionProof, forbiddenProof } = input;
  const reviewFinalGate = reports.runtimeLimitedPilotReadinessReviewFinalSafetyGate;
  const reviewVerification = reports.runtimeLimitedPilotReadinessReviewVerificationReport;
  const reviewAlignment = reports.runtimeLimitedPilotReadinessReviewAlignmentReport;
  const reviewViolation = reports.runtimeLimitedPilotReadinessReviewViolationReport;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;

  const reviewFinalGateReady =
    reviewFinalGate.finalGateStatus === "ready_metadata" && reviewFinalGate.h44EntryReadiness === "ready_metadata";
  const reviewVerified = reviewVerification.verificationStatus === "verified_metadata";
  const reviewAligned = reviewAlignment.alignmentStatus === "aligned_metadata";
  const noActualFlagViolations = reviewViolation.actualFlagViolations.length === 0;
  const noProofViolations = reviewViolation.proofViolations.length === 0;
  const noForbiddenProofViolations = reviewViolation.forbiddenProofViolations.length === 0;
  const noExecutionBlockers = blockerReport.blockers.length === 0;
  const finalNoExecutionDiagnosticOnly = isRuntimeFinalPilotNoExecutionProofValid(noExecutionProof);
  const finalForbiddenProofComplete = isRuntimeFinalPilotExecutionForbiddenProofComplete(forbiddenProof);
  const operatorApprovalReady =
    approval.approvalReadiness === "ready_for_review_metadata" || approval.approvalReadiness === "not_required";
  const rollbackReady =
    rollback.rollbackReadiness === "metadata_ready" || rollback.rollbackReadiness === "not_applicable";
  const auditSufficient = audit.auditReadiness === "sufficient_metadata" || audit.auditReadiness === "minimal";

  const rows: { readonly label: string; readonly ok: boolean }[] = [
    { label: "limited pilot readiness review final gate ready_metadata", ok: reviewFinalGateReady },
    { label: "h44 entry readiness ready_metadata", ok: reviewFinalGate.h44EntryReadiness === "ready_metadata" },
    { label: "limited pilot readiness review verification verified_metadata", ok: reviewVerified },
    { label: "limited pilot readiness review alignment aligned_metadata", ok: reviewAligned },
    { label: "no limited pilot readiness review actual flag violations", ok: noActualFlagViolations },
    { label: "no limited pilot readiness review proof violations", ok: noProofViolations },
    { label: "no limited pilot readiness review forbidden proof violations", ok: noForbiddenProofViolations },
    { label: "no pilot execution readiness blockers", ok: noExecutionBlockers },
    { label: "final pilot no-execution proof diagnosticOnly", ok: finalNoExecutionDiagnosticOnly },
    { label: "final pilot execution-forbidden proof complete", ok: finalForbiddenProofComplete },
    { label: "operator approval metadata ready", ok: operatorApprovalReady },
    { label: "rollback readiness metadata ready", ok: rollbackReady },
    { label: "audit readiness metadata sufficient", ok: auditSufficient },
    { label: "actual pilot activation disabled", ok: true },
    { label: "actual pilot execution disabled", ok: true },
    { label: "actual isolated runner invocation disabled", ok: true },
    { label: "actual isolated runner execution disabled", ok: true },
    { label: "actual dry-run runner invocation disabled", ok: true },
    { label: "actual dry-run runner execution disabled", ok: true },
    { label: "actual runtime adapter invocation disabled", ok: true },
    { label: "actual sandbox invocation disabled", ok: true },
    { label: "actual execution disabled", ok: true },
    { label: "actual execution routing disabled", ok: true },
    { label: "actual release enforcement disabled", ok: true },
    { label: "actual approval enforcement disabled", ok: true },
    { label: "actual execution blocking disabled", ok: true },
    { label: "actual merge blocking disabled", ok: true },
  ];

  const checklist = mergeSortedUniqueKo(rows.map((r) => `${r.label}:${r.ok}`));
  const missingRows = mergeSortedUniqueKo(rows.filter((r) => !r.ok).map((r) => r.label));

  const blockers: string[] = [];
  if (!reviewFinalGateReady) blockers.push("limited pilot readiness review final gate not ready_metadata");
  if (!reviewVerified) blockers.push("limited pilot readiness review verification not verified_metadata");
  if (!reviewAligned) blockers.push("limited pilot readiness review alignment not aligned_metadata");
  if (!noActualFlagViolations) blockers.push("limited pilot readiness review actual flag violations present");
  if (!noProofViolations) blockers.push("limited pilot readiness review proof violations present");
  if (!noForbiddenProofViolations) blockers.push("limited pilot readiness review forbidden proof violations present");
  if (!noExecutionBlockers) blockers.push(...blockerReport.blockers.slice(0, 2));
  if (!finalNoExecutionDiagnosticOnly) blockers.push("final pilot no-execution proof diagnosticOnly not true");
  if (!finalForbiddenProofComplete) blockers.push("final pilot execution-forbidden proof incomplete");

  return {
    mode: "runtime_pilot_execution_readiness_checklist",
    ...RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED,
    checklist,
    missingRows,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations: mergeSortedUniqueKo([
      ...(missingRows.length === 0
        ? ["H44: pilot execution readiness checklist pass — metadata_only boundary(pilot activation·execution 없음)"]
        : ["H44: pilot execution readiness checklist incomplete — limited pilot readiness review final gate 정렬"]),
      ...blockerReport.recommendations,
    ]),
  };
}
