/**
 * H37 — governance boundary **readiness checklist**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeExecutionGovernanceBoundary } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type {
  RuntimeExecutionGovernanceBoundaryBlockerReport,
  RuntimeExecutionGovernanceBoundaryReadinessChecklist,
} from "./runtimeExecutionGovernanceBoundaryTypes";

export function buildRuntimeExecutionGovernanceBoundaryReadinessChecklist(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeExecutionGovernanceBoundary;
  readonly blockerReport: RuntimeExecutionGovernanceBoundaryBlockerReport;
}): RuntimeExecutionGovernanceBoundaryReadinessChecklist {
  const { reports, blockerReport } = input;
  const shellFinalGate = reports.runtimeExecutionBoundaryShellFinalSafetyGate;
  const shellReadiness = reports.runtimeExecutionBoundaryShellReadinessVerificationReport;
  const shellAlignment = reports.runtimeExecutionBoundaryShellAlignmentReport;
  const shellBoundaryViolation = reports.runtimeExecutionBoundaryShellBoundaryViolationReport;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;

  const shellFinalGateReady =
    shellFinalGate.finalGateStatus === "ready_metadata" && shellFinalGate.h37EntryReadiness === "ready_metadata";
  const shellReadinessVerified = shellReadiness.verificationStatus === "verified_metadata";
  const shellAlignmentAligned = shellAlignment.alignmentStatus === "aligned_metadata";
  const noShellViolations = shellBoundaryViolation.actualFlagViolations.length === 0;
  const noGovernanceBlockers = blockerReport.blockers.length === 0;
  const operatorApprovalReady =
    approval.approvalReadiness === "ready_for_review_metadata" || approval.approvalReadiness === "not_required";
  const rollbackReady =
    rollback.rollbackReadiness === "metadata_ready" || rollback.rollbackReadiness === "not_applicable";
  const auditSufficient = audit.auditReadiness === "sufficient_metadata" || audit.auditReadiness === "minimal";

  const rows: { readonly label: string; readonly ok: boolean }[] = [
    { label: "execution boundary shell final gate ready_metadata", ok: shellFinalGateReady },
    { label: "h37 entry readiness ready_metadata", ok: shellFinalGate.h37EntryReadiness === "ready_metadata" },
    {
      label: "execution boundary shell readiness verification verified_metadata",
      ok: shellReadinessVerified,
    },
    { label: "execution boundary shell alignment aligned_metadata", ok: shellAlignmentAligned },
    { label: "no execution boundary shell violations", ok: noShellViolations },
    { label: "no governance boundary blockers", ok: noGovernanceBlockers },
    { label: "operator approval metadata ready", ok: operatorApprovalReady },
    { label: "rollback readiness metadata ready", ok: rollbackReady },
    { label: "audit readiness metadata sufficient", ok: auditSufficient },
    { label: "actual execution disabled", ok: true },
    { label: "actual execution routing disabled", ok: true },
    { label: "actual release enforcement disabled", ok: true },
    { label: "actual shell execution disabled", ok: true },
    { label: "actual provider routing disabled", ok: true },
    { label: "actual approval enforcement disabled", ok: true },
  ];

  const checklist = mergeSortedUniqueKo(rows.map((r) => `${r.label}:${r.ok}`));
  const missingRows = mergeSortedUniqueKo(rows.filter((r) => !r.ok).map((r) => r.label));

  const blockers: string[] = [];
  if (!shellFinalGateReady) blockers.push("execution boundary shell final gate not ready_metadata");
  if (!shellReadinessVerified) blockers.push("execution boundary shell readiness not verified_metadata");
  if (!shellAlignmentAligned) blockers.push("execution boundary shell alignment not aligned_metadata");
  if (!noShellViolations) blockers.push("execution boundary shell boundary violations present");
  if (!noGovernanceBlockers) blockers.push(...blockerReport.blockers.slice(0, 2));

  const recommendations = mergeSortedUniqueKo([
    ...(missingRows.length === 0
      ? ["H37: governance boundary checklist pass — hardening metadata candidate(집행 없음)"]
      : ["H37: governance boundary checklist incomplete — execution boundary shell final gate·violations 정렬"]),
    ...blockerReport.recommendations,
  ]);

  return {
    mode: "runtime_execution_governance_boundary_readiness_checklist",
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
