/**
 * H41 — controlled activation **readiness checklist**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeControlledActivationCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  isRuntimeOrchestrationForbiddenProofComplete,
  isRuntimeUltimateNoEnforcementProofValid,
} from "@/lib/harness/runtimeUltimateGovernanceReview/runtimeUltimateGovernanceReviewCheckHelpers";
import { readControlledActivationUpstreamContext } from "./runtimeControlledActivationCandidateCheckHelpers";
import { RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS_DISABLED } from "./runtimeControlledActivationCandidateConstants";
import type {
  RuntimeControlledActivationCandidateBlockerReport,
  RuntimeControlledActivationReadinessChecklist,
} from "./runtimeControlledActivationCandidateTypes";

export function buildRuntimeControlledActivationReadinessChecklist(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeControlledActivationCandidate;
  readonly blockerReport: RuntimeControlledActivationCandidateBlockerReport;
}): RuntimeControlledActivationReadinessChecklist {
  const { reports, blockerReport } = input;
  const {
    ultimateFinalGate,
    ultimateVerification,
    ultimateAlignment,
    ultimateViolation,
    noEnforcementProof,
    forbiddenProof,
    approval,
    rollback,
    audit,
  } = readControlledActivationUpstreamContext(reports);

  const ultimateFinalGateReady =
    ultimateFinalGate.finalGateStatus === "ready_metadata" &&
    ultimateFinalGate.h41EntryReadiness === "ready_metadata";
  const ultimateVerified = ultimateVerification.verificationStatus === "verified_metadata";
  const ultimateAligned = ultimateAlignment.alignmentStatus === "aligned_metadata";
  const noActualFlagViolations = ultimateViolation.actualFlagViolations.length === 0;
  const noProofViolations = ultimateViolation.proofViolations.length === 0;
  const noActivationBlockers = blockerReport.blockers.length === 0;
  const noEnforcementDiagnosticOnly = isRuntimeUltimateNoEnforcementProofValid(noEnforcementProof);
  const forbiddenProofComplete = isRuntimeOrchestrationForbiddenProofComplete(forbiddenProof);
  const operatorApprovalReady =
    approval.approvalReadiness === "ready_for_review_metadata" || approval.approvalReadiness === "not_required";
  const rollbackReady =
    rollback.rollbackReadiness === "metadata_ready" || rollback.rollbackReadiness === "not_applicable";
  const auditSufficient = audit.auditReadiness === "sufficient_metadata" || audit.auditReadiness === "minimal";

  const rows: { readonly label: string; readonly ok: boolean }[] = [
    { label: "ultimate governance review final gate ready_metadata", ok: ultimateFinalGateReady },
    { label: "h41 entry readiness ready_metadata", ok: ultimateFinalGate.h41EntryReadiness === "ready_metadata" },
    {
      label: "ultimate governance review verification verified_metadata",
      ok: ultimateVerified,
    },
    { label: "ultimate governance review alignment aligned_metadata", ok: ultimateAligned },
    { label: "no ultimate governance actual flag violations", ok: noActualFlagViolations },
    { label: "no ultimate governance proof violations", ok: noProofViolations },
    { label: "no controlled activation blockers", ok: noActivationBlockers },
    { label: "ultimate no-enforcement proof diagnosticOnly", ok: noEnforcementDiagnosticOnly },
    { label: "orchestration-forbidden proof complete", ok: forbiddenProofComplete },
    { label: "operator approval metadata ready", ok: operatorApprovalReady },
    { label: "rollback readiness metadata ready", ok: rollbackReady },
    { label: "audit readiness metadata sufficient", ok: auditSufficient },
    { label: "actual runtime orchestration disabled", ok: true },
    { label: "actual controlled activation disabled", ok: true },
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
  if (!ultimateFinalGateReady) blockers.push("ultimate governance review final gate not ready_metadata");
  if (!ultimateVerified) blockers.push("ultimate governance review verification not verified_metadata");
  if (!ultimateAligned) blockers.push("ultimate governance review alignment not aligned_metadata");
  if (!noActualFlagViolations) blockers.push("ultimate governance actual flag violations present");
  if (!noProofViolations) blockers.push("ultimate governance proof violations present");
  if (!noActivationBlockers) blockers.push(...blockerReport.blockers.slice(0, 2));

  const recommendations = mergeSortedUniqueKo([
    ...(missingRows.length === 0
      ? ["H41: controlled activation readiness checklist pass — metadata_only candidate(activation 없음)"]
      : ["H41: controlled activation readiness checklist incomplete — ultimate governance final gate 정렬"]),
    ...blockerReport.recommendations,
  ]);

  return {
    mode: "runtime_controlled_activation_readiness_checklist",
    ...RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
    checklist,
    missingRows,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
