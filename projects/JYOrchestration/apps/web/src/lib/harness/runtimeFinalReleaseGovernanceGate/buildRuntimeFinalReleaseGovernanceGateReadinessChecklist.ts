/**
 * H39 — final release governance gate **readiness checklist**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { isRuntimeExecutionGovernanceForbiddenProofComplete } from "@/lib/harness/runtimeGovernanceReleaseReadiness/buildRuntimeExecutionGovernanceForbiddenProof";
import type { RuntimeSemanticPlanningReportsBeforeFinalReleaseGovernanceGate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type {
  RuntimeFinalReleaseGovernanceGateBlockerReport,
  RuntimeFinalReleaseGovernanceGateReadinessChecklist,
} from "./runtimeFinalReleaseGovernanceGateTypes";

export function buildRuntimeFinalReleaseGovernanceGateReadinessChecklist(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeFinalReleaseGovernanceGate;
  readonly blockerReport: RuntimeFinalReleaseGovernanceGateBlockerReport;
}): RuntimeFinalReleaseGovernanceGateReadinessChecklist {
  const { reports, blockerReport } = input;
  const releaseFinalGate = reports.runtimeGovernanceReleaseReadinessFinalSafetyGate;
  const releaseReadiness = reports.runtimeGovernanceReleaseReadinessVerificationReport;
  const releaseAlignment = reports.runtimeGovernanceReleaseReadinessAlignmentReport;
  const releaseViolation = reports.runtimeGovernanceReleaseReadinessViolationReport;
  const noEnforcementProof = reports.runtimeGovernanceNoEnforcementProof;
  const forbiddenProof = reports.runtimeExecutionGovernanceForbiddenProof;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;

  const releaseFinalGateReady =
    releaseFinalGate.finalGateStatus === "ready_metadata" && releaseFinalGate.h39EntryReadiness === "ready_metadata";
  const releaseReadinessVerified = releaseReadiness.verificationStatus === "verified_metadata";
  const releaseAlignmentAligned = releaseAlignment.alignmentStatus === "aligned_metadata";
  const noActualFlagViolations = releaseViolation.actualFlagViolations.length === 0;
  const noProofViolations = releaseViolation.proofViolations.length === 0;
  const noGateBlockers = blockerReport.blockers.length === 0;
  const noEnforcementDiagnosticOnly = noEnforcementProof.diagnosticOnly === true;
  const forbiddenProofComplete = isRuntimeExecutionGovernanceForbiddenProofComplete(forbiddenProof);
  const operatorApprovalReady =
    approval.approvalReadiness === "ready_for_review_metadata" || approval.approvalReadiness === "not_required";
  const rollbackReady =
    rollback.rollbackReadiness === "metadata_ready" || rollback.rollbackReadiness === "not_applicable";
  const auditSufficient = audit.auditReadiness === "sufficient_metadata" || audit.auditReadiness === "minimal";

  const rows: { readonly label: string; readonly ok: boolean }[] = [
    { label: "governance release-readiness final gate ready_metadata", ok: releaseFinalGateReady },
    { label: "h39 entry readiness ready_metadata", ok: releaseFinalGate.h39EntryReadiness === "ready_metadata" },
    {
      label: "governance release-readiness verification verified_metadata",
      ok: releaseReadinessVerified,
    },
    { label: "governance release-readiness alignment aligned_metadata", ok: releaseAlignmentAligned },
    { label: "no release-readiness actual flag violations", ok: noActualFlagViolations },
    { label: "no release-readiness proof violations", ok: noProofViolations },
    { label: "no final governance gate blockers", ok: noGateBlockers },
    { label: "no-enforcement proof diagnosticOnly", ok: noEnforcementDiagnosticOnly },
    { label: "execution-governance-forbidden proof complete", ok: forbiddenProofComplete },
    { label: "operator approval metadata ready", ok: operatorApprovalReady },
    { label: "rollback readiness metadata ready", ok: rollbackReady },
    { label: "audit readiness metadata sufficient", ok: auditSufficient },
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
  if (!releaseFinalGateReady) blockers.push("governance release-readiness final gate not ready_metadata");
  if (!releaseReadinessVerified) blockers.push("governance release-readiness verification not verified_metadata");
  if (!releaseAlignmentAligned) blockers.push("governance release-readiness alignment not aligned_metadata");
  if (!noActualFlagViolations) blockers.push("release-readiness actual flag violations present");
  if (!noProofViolations) blockers.push("release-readiness proof violations present");
  if (!noGateBlockers) blockers.push(...blockerReport.blockers.slice(0, 2));

  const recommendations = mergeSortedUniqueKo([
    ...(missingRows.length === 0
      ? ["H39: final release governance gate checklist pass — metadata_only candidate(집행 없음)"]
      : ["H39: final release governance gate checklist incomplete — governance release-readiness final gate 정렬"]),
    ...blockerReport.recommendations,
  ]);

  return {
    mode: "runtime_final_release_governance_gate_readiness_checklist",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualReleaseEnforcementEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualExecutionRoutingEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    actualApprovalEnforcementEnabled: false,
    actualExecutionBlockingEnabled: false,
    actualMergeBlockingEnabled: false,
    checklist,
    missingRows,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
