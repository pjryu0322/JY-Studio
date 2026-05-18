/**
 * H43 — pilot contract **readiness checklist**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeLimitedPilotReadinessReview } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  isRuntimePilotExecutionForbiddenProofComplete,
  isRuntimePilotNoExecutionProofValid,
} from "./runtimeLimitedPilotReadinessReviewCheckHelpers";
import { RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED } from "./runtimeLimitedPilotReadinessReviewConstants";
import type {
  RuntimePilotContractReadinessChecklist,
  RuntimePilotExecutionForbiddenProof,
  RuntimePilotNoExecutionProof,
  RuntimePilotReadinessBlockerReport,
} from "./runtimeLimitedPilotReadinessReviewTypes";

export function buildRuntimePilotContractReadinessChecklist(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeLimitedPilotReadinessReview;
  readonly blockerReport: RuntimePilotReadinessBlockerReport;
  readonly noExecutionProof: RuntimePilotNoExecutionProof;
  readonly forbiddenProof: RuntimePilotExecutionForbiddenProof;
}): RuntimePilotContractReadinessChecklist {
  const { reports, blockerReport, noExecutionProof, forbiddenProof } = input;
  const finalGate = reports.runtimeLimitedPilotBoundaryFinalSafetyGate;
  const verification = reports.runtimeLimitedPilotBoundaryVerificationReport;
  const alignment = reports.runtimeLimitedPilotBoundaryAlignmentReport;
  const violation = reports.runtimeLimitedPilotBoundaryViolationReport;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;

  const pilotFinalGateReady =
    finalGate.finalGateStatus === "ready_metadata" && finalGate.h43EntryReadiness === "ready_metadata";
  const pilotVerified = verification.verificationStatus === "verified_metadata";
  const pilotAligned = alignment.alignmentStatus === "aligned_metadata";
  const noActualFlagViolations = violation.actualFlagViolations.length === 0;
  const noPolicyViolations = violation.policyViolations.length === 0;
  const noReadinessBlockers = blockerReport.blockers.length === 0;
  const noExecutionDiagnosticOnly = isRuntimePilotNoExecutionProofValid(noExecutionProof);
  const forbiddenProofComplete = isRuntimePilotExecutionForbiddenProofComplete(forbiddenProof);
  const operatorApprovalReady =
    approval.approvalReadiness === "ready_for_review_metadata" || approval.approvalReadiness === "not_required";
  const rollbackReady =
    rollback.rollbackReadiness === "metadata_ready" || rollback.rollbackReadiness === "not_applicable";
  const auditSufficient = audit.auditReadiness === "sufficient_metadata" || audit.auditReadiness === "minimal";

  const rows: { readonly label: string; readonly ok: boolean }[] = [
    { label: "limited pilot boundary final gate ready_metadata", ok: pilotFinalGateReady },
    { label: "h43 entry readiness ready_metadata", ok: finalGate.h43EntryReadiness === "ready_metadata" },
    { label: "limited pilot boundary verification verified_metadata", ok: pilotVerified },
    { label: "limited pilot boundary alignment aligned_metadata", ok: pilotAligned },
    { label: "no limited pilot boundary actual flag violations", ok: noActualFlagViolations },
    { label: "no limited pilot boundary policy violations", ok: noPolicyViolations },
    { label: "no pilot readiness blockers", ok: noReadinessBlockers },
    { label: "pilot no-execution proof diagnosticOnly", ok: noExecutionDiagnosticOnly },
    { label: "pilot execution-forbidden proof complete", ok: forbiddenProofComplete },
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
  if (!pilotFinalGateReady) blockers.push("limited pilot boundary final gate not ready_metadata");
  if (!pilotVerified) blockers.push("limited pilot boundary verification not verified_metadata");
  if (!pilotAligned) blockers.push("limited pilot boundary alignment not aligned_metadata");
  if (!noActualFlagViolations) blockers.push("limited pilot boundary actual flag violations present");
  if (!noPolicyViolations) blockers.push("limited pilot boundary policy violations present");
  if (!noReadinessBlockers) blockers.push(...blockerReport.blockers.slice(0, 2));
  if (!noExecutionDiagnosticOnly) blockers.push("pilot no-execution proof diagnosticOnly not true");
  if (!forbiddenProofComplete) blockers.push("pilot execution-forbidden proof incomplete");

  return {
    mode: "runtime_pilot_contract_readiness_checklist",
    ...RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED,
    checklist,
    missingRows,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations: mergeSortedUniqueKo([
      ...(missingRows.length === 0
        ? ["H43: pilot contract readiness checklist pass — metadata_only review(pilot activation·execution 없음)"]
        : ["H43: pilot contract readiness checklist incomplete — limited pilot boundary final gate 정렬"]),
      ...blockerReport.recommendations,
    ]),
  };
}
