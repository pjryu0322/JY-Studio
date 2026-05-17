/**
 * H45 — controlled pilot execution **readiness checklist**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  isRuntimeFinalPilotExecutionForbiddenProofComplete,
  isRuntimeFinalPilotNoExecutionProofValid,
  readControlledPilotExecutionUpstreamContext,
} from "./runtimeControlledPilotExecutionCandidateCheckHelpers";
import { RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED } from "./runtimeControlledPilotExecutionCandidateConstants";
import type {
  RuntimeControlledPilotExecutionCandidateBlockerReport,
  RuntimeControlledPilotExecutionReadinessChecklist,
} from "./runtimeControlledPilotExecutionCandidateTypes";

export function buildRuntimeControlledPilotExecutionReadinessChecklist(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate;
  readonly blockerReport: RuntimeControlledPilotExecutionCandidateBlockerReport;
}): RuntimeControlledPilotExecutionReadinessChecklist {
  const { reports, blockerReport } = input;
  const {
    executionFinalGate,
    executionVerification,
    executionAlignment,
    executionViolation,
    noExecutionProof,
    forbiddenProof,
    approval,
    rollback,
    audit,
  } = readControlledPilotExecutionUpstreamContext(reports);

  const executionFinalGateReady =
    executionFinalGate.finalGateStatus === "ready_metadata" &&
    executionFinalGate.h45EntryReadiness === "ready_metadata";
  const executionVerified = executionVerification.verificationStatus === "verified_metadata";
  const executionAligned = executionAlignment.alignmentStatus === "aligned_metadata";
  const noActualFlagViolations = executionViolation.actualFlagViolations.length === 0;
  const noProofViolations = executionViolation.proofViolations.length === 0;
  const noForbiddenProofViolations = executionViolation.forbiddenProofViolations.length === 0;
  const noCandidateBlockers = blockerReport.blockers.length === 0;
  const noExecutionDiagnosticOnly = isRuntimeFinalPilotNoExecutionProofValid(noExecutionProof);
  const forbiddenProofComplete = isRuntimeFinalPilotExecutionForbiddenProofComplete(forbiddenProof);
  const operatorApprovalReady =
    approval.approvalReadiness === "ready_for_review_metadata" || approval.approvalReadiness === "not_required";
  const rollbackReady =
    rollback.rollbackReadiness === "metadata_ready" || rollback.rollbackReadiness === "not_applicable";
  const auditSufficient = audit.auditReadiness === "sufficient_metadata" || audit.auditReadiness === "minimal";

  const rows: { readonly label: string; readonly ok: boolean }[] = [
    { label: "pilot execution readiness final gate ready_metadata", ok: executionFinalGateReady },
    { label: "h45 entry readiness ready_metadata", ok: executionFinalGate.h45EntryReadiness === "ready_metadata" },
    {
      label: "pilot execution readiness verification verified_metadata",
      ok: executionVerified,
    },
    { label: "pilot execution readiness alignment aligned_metadata", ok: executionAligned },
    { label: "no pilot execution readiness actual flag violations", ok: noActualFlagViolations },
    { label: "no pilot execution readiness proof violations", ok: noProofViolations },
    { label: "no pilot execution readiness forbidden proof violations", ok: noForbiddenProofViolations },
    { label: "no controlled pilot execution blockers", ok: noCandidateBlockers },
    { label: "final pilot no-execution proof diagnosticOnly", ok: noExecutionDiagnosticOnly },
    { label: "final pilot execution-forbidden proof complete", ok: forbiddenProofComplete },
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
  if (!executionFinalGateReady) blockers.push("pilot execution readiness final gate not ready_metadata");
  if (!executionVerified) blockers.push("pilot execution readiness verification not verified_metadata");
  if (!executionAligned) blockers.push("pilot execution readiness alignment not aligned_metadata");
  if (!noActualFlagViolations) blockers.push("pilot execution readiness actual flag violations present");
  if (!noProofViolations) blockers.push("pilot execution readiness proof violations present");
  if (!noForbiddenProofViolations) blockers.push("pilot execution readiness forbidden proof violations present");
  if (!noCandidateBlockers) blockers.push(...blockerReport.blockers.slice(0, 2));

  const recommendations = mergeSortedUniqueKo([
    ...(missingRows.length === 0
      ? [
          "H45: controlled pilot execution readiness checklist pass — metadata_only candidate(pilot activation·execution 없음)",
        ]
      : ["H45: controlled pilot execution readiness checklist incomplete — pilot execution readiness final gate 정렬"]),
    ...blockerReport.recommendations,
  ]);

  return {
    mode: "runtime_controlled_pilot_execution_readiness_checklist",
    ...RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
    checklist,
    missingRows,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
