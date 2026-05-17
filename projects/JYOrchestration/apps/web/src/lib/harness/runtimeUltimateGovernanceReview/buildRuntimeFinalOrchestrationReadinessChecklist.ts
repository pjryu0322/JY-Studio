/**
 * H40 — final orchestration readiness **checklist**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeUltimateGovernanceReview } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  isRuntimeOrchestrationForbiddenProofComplete,
  isRuntimeUltimateNoEnforcementProofValid,
  readUltimateGovernanceUpstreamContext,
} from "./runtimeUltimateGovernanceReviewCheckHelpers";
import { RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED } from "./runtimeUltimateGovernanceReviewConstants";
import type {
  RuntimeOrchestrationForbiddenProof,
  RuntimeUltimateGovernanceBlockerReport,
  RuntimeFinalOrchestrationReadinessChecklist,
  RuntimeUltimateNoEnforcementProof,
} from "./runtimeUltimateGovernanceReviewTypes";

export function buildRuntimeFinalOrchestrationReadinessChecklist(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeUltimateGovernanceReview;
  readonly blockerReport: RuntimeUltimateGovernanceBlockerReport;
  readonly noEnforcementProof: RuntimeUltimateNoEnforcementProof;
  readonly forbiddenProof: RuntimeOrchestrationForbiddenProof;
}): RuntimeFinalOrchestrationReadinessChecklist {
  const { reports, blockerReport, noEnforcementProof, forbiddenProof } = input;
  const upstream = readUltimateGovernanceUpstreamContext(reports);
  const { finalGate, finalVerification, finalAlignment, finalViolation, approval, rollback, audit } =
    upstream;

  const finalGateReady =
    finalGate.finalGateStatus === "ready_metadata" && finalGate.h40EntryReadiness === "ready_metadata";
  const finalVerificationVerified = finalVerification.verificationStatus === "verified_metadata";
  const finalAlignmentAligned = finalAlignment.alignmentStatus === "aligned_metadata";
  const noFinalViolations =
    finalViolation.actualFlagViolations.length === 0 && finalViolation.wordingRiskFindings.length === 0;
  const noUltimateBlockers = blockerReport.blockers.length === 0;
  const noEnforcementDiagnosticOnly = isRuntimeUltimateNoEnforcementProofValid(noEnforcementProof);
  const forbiddenProofComplete = isRuntimeOrchestrationForbiddenProofComplete(forbiddenProof);
  const operatorApprovalReady =
    approval.approvalReadiness === "ready_for_review_metadata" || approval.approvalReadiness === "not_required";
  const rollbackReady =
    rollback.rollbackReadiness === "metadata_ready" || rollback.rollbackReadiness === "not_applicable";
  const auditSufficient = audit.auditReadiness === "sufficient_metadata" || audit.auditReadiness === "minimal";

  const rows: { readonly label: string; readonly ok: boolean }[] = [
    { label: "final release governance gate final gate ready_metadata", ok: finalGateReady },
    { label: "h40 entry readiness ready_metadata", ok: finalGate.h40EntryReadiness === "ready_metadata" },
    {
      label: "final release governance gate verification verified_metadata",
      ok: finalVerificationVerified,
    },
    { label: "final release governance gate alignment aligned_metadata", ok: finalAlignmentAligned },
    { label: "no final release governance gate violations", ok: noFinalViolations },
    { label: "no ultimate governance blockers", ok: noUltimateBlockers },
    { label: "ultimate no-enforcement proof diagnosticOnly", ok: noEnforcementDiagnosticOnly },
    { label: "orchestration-forbidden proof complete", ok: forbiddenProofComplete },
    { label: "operator approval metadata ready", ok: operatorApprovalReady },
    { label: "rollback readiness metadata ready", ok: rollbackReady },
    { label: "audit readiness metadata sufficient", ok: auditSufficient },
    { label: "actual orchestration disabled", ok: true },
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
  if (!finalGateReady) blockers.push("final release governance gate final gate not ready_metadata");
  if (!finalVerificationVerified) blockers.push("final release governance gate verification not verified_metadata");
  if (!finalAlignmentAligned) blockers.push("final release governance gate alignment not aligned_metadata");
  if (!noEnforcementDiagnosticOnly) blockers.push("ultimate no-enforcement proof not diagnosticOnly");
  if (!forbiddenProofComplete) blockers.push("orchestration-forbidden proof incomplete");
  if (!noUltimateBlockers) blockers.push(...blockerReport.blockers.slice(0, 2));

  return {
    mode: "runtime_final_orchestration_readiness_checklist",
    ...RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED,
    checklist,
    missingRows,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations: mergeSortedUniqueKo([
      ...(missingRows.length === 0
        ? ["H40: final orchestration readiness checklist pass — H40.5 entry 후보(orchestration 없음)"]
        : ["H40: final orchestration readiness checklist incomplete — final gate·proof 정렬"]),
      ...blockerReport.recommendations,
    ]),
  };
}
