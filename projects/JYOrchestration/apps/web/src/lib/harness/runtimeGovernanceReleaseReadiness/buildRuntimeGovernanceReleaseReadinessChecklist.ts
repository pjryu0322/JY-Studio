/**
 * H38 — governance release-readiness **checklist**(read-only; H38.5 entry).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeGovernanceReleaseReadiness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { isRuntimeExecutionGovernanceForbiddenProofComplete } from "./buildRuntimeExecutionGovernanceForbiddenProof";
import type {
  RuntimeGovernanceNoEnforcementProof,
  RuntimeExecutionGovernanceForbiddenProof,
  RuntimeGovernanceReleaseBlockerReport,
  RuntimeGovernanceReleaseReadinessChecklist,
} from "./runtimeGovernanceReleaseReadinessTypes";

export function buildRuntimeGovernanceReleaseReadinessChecklist(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeGovernanceReleaseReadiness;
  readonly blockerReport: RuntimeGovernanceReleaseBlockerReport;
  readonly noEnforcementProof: RuntimeGovernanceNoEnforcementProof;
  readonly forbiddenProof: RuntimeExecutionGovernanceForbiddenProof;
}): RuntimeGovernanceReleaseReadinessChecklist {
  const { reports, blockerReport, noEnforcementProof, forbiddenProof } = input;
  const governanceFinalGate = reports.runtimeExecutionGovernanceBoundaryFinalSafetyGate;
  const governanceReadiness = reports.runtimeExecutionGovernanceBoundaryReadinessVerificationReport;
  const governanceAlignment = reports.runtimeExecutionGovernanceBoundaryAlignmentReport;
  const governanceViolation = reports.runtimeExecutionGovernanceBoundaryViolationReport;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;

  const governanceFinalGateReady =
    governanceFinalGate.finalGateStatus === "ready_metadata" &&
    governanceFinalGate.h38EntryReadiness === "ready_metadata";
  const governanceReadinessVerified = governanceReadiness.verificationStatus === "verified_metadata";
  const governanceAlignmentAligned = governanceAlignment.alignmentStatus === "aligned_metadata";
  const noGovernanceViolations = governanceViolation.actualFlagViolations.length === 0;
  const noReleaseBlockers = blockerReport.blockers.length === 0;
  const noEnforcementDiagnosticOnly = noEnforcementProof.diagnosticOnly === true;
  const forbiddenProofComplete = isRuntimeExecutionGovernanceForbiddenProofComplete(forbiddenProof);
  const operatorApprovalReady =
    approval.approvalReadiness === "ready_for_review_metadata" || approval.approvalReadiness === "not_required";
  const rollbackReady =
    rollback.rollbackReadiness === "metadata_ready" || rollback.rollbackReadiness === "not_applicable";
  const auditSufficient = audit.auditReadiness === "sufficient_metadata" || audit.auditReadiness === "minimal";

  const rows: { readonly label: string; readonly ok: boolean }[] = [
    { label: "governance boundary final safety gate ready_metadata", ok: governanceFinalGateReady },
    { label: "h38 entry readiness ready_metadata", ok: governanceFinalGate.h38EntryReadiness === "ready_metadata" },
    {
      label: "governance boundary readiness verification verified_metadata",
      ok: governanceReadinessVerified,
    },
    { label: "governance boundary alignment aligned_metadata", ok: governanceAlignmentAligned },
    { label: "no governance boundary violations", ok: noGovernanceViolations },
    { label: "no release-readiness blockers", ok: noReleaseBlockers },
    { label: "no-enforcement proof diagnosticOnly", ok: noEnforcementDiagnosticOnly },
    { label: "execution-governance-forbidden proof complete", ok: forbiddenProofComplete },
    { label: "operator approval metadata ready", ok: operatorApprovalReady },
    { label: "rollback readiness metadata ready", ok: rollbackReady },
    { label: "audit readiness metadata sufficient", ok: auditSufficient },
    { label: "actual execution disabled", ok: true },
    { label: "actual execution routing disabled", ok: true },
    { label: "actual release enforcement disabled", ok: true },
    { label: "actual approval enforcement disabled", ok: true },
    { label: "actual provider routing disabled", ok: true },
  ];

  const checklist = mergeSortedUniqueKo(rows.map((r) => `${r.label}:${r.ok}`));
  const missingRows = mergeSortedUniqueKo(rows.filter((r) => !r.ok).map((r) => r.label));

  const blockers: string[] = [];
  if (!governanceFinalGateReady) blockers.push("governance boundary final gate not ready_metadata");
  if (!governanceReadinessVerified) blockers.push("governance boundary readiness not verified_metadata");
  if (!governanceAlignmentAligned) blockers.push("governance boundary alignment not aligned_metadata");
  if (!noEnforcementDiagnosticOnly) blockers.push("no-enforcement proof not diagnosticOnly");
  if (!forbiddenProofComplete) blockers.push("execution-governance-forbidden proof incomplete");
  if (!noReleaseBlockers) blockers.push(...blockerReport.blockers.slice(0, 2));

  const recommendations = mergeSortedUniqueKo([
    ...(missingRows.length === 0
      ? ["H38: governance release-readiness checklist pass — H38.5 entry 후보(enforcement 없음)"]
      : ["H38: governance release-readiness checklist incomplete — final gate·proof 정렬"]),
    ...blockerReport.recommendations,
  ]);

  return {
    mode: "runtime_governance_release_readiness_checklist",
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
    checklist,
    missingRows,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
