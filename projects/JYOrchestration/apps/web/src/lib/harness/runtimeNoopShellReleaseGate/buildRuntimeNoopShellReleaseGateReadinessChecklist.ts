/**
 * H34 — release-gate **readiness checklist**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeNoopShellReleaseGate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type {
  RuntimeNoopShellReleaseGateBlockerReport,
  RuntimeNoopShellReleaseGateReadinessChecklist,
} from "./runtimeNoopShellReleaseGateTypes";

export function buildRuntimeNoopShellReleaseGateReadinessChecklist(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeNoopShellReleaseGate;
  readonly blockerReport: RuntimeNoopShellReleaseGateBlockerReport;
}): RuntimeNoopShellReleaseGateReadinessChecklist {
  const { reports, blockerReport } = input;
  const hardeningGate = reports.runtimeNoopShellHardeningFinalSafetyGate;
  const readinessVerification = reports.runtimeNoopShellHardeningReadinessVerificationReport;
  const alignment = reports.runtimeNoopShellHardeningAlignmentReport;
  const boundary = reports.runtimeNoopShellHardeningBoundaryViolationReport;
  const result = reports.runtimeNoopShellNoExecutionResultMetadata;
  const guard = reports.runtimeNoopShellHardeningSafetyGuard;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;

  const hardeningFinalGateReady =
    hardeningGate.finalGateStatus === "ready_metadata" && hardeningGate.h34EntryReadiness === "ready_metadata";
  const hardeningReadinessVerified = readinessVerification.verificationStatus === "verified_metadata";
  const hardeningAlignmentAligned = alignment.alignmentStatus === "aligned_metadata";
  const noHardeningBoundaryViolations = boundary.actualFlagViolations.length === 0;
  const noReleaseGateBlockers = blockerReport.blockers.length === 0;
  const noopResultDiagnosticOnly = result.diagnosticOnly === true;
  const safetyGuardForbidsExecution = guard.actualShellExecutionForbidden === true;
  const operatorApprovalReady =
    approval.approvalReadiness === "ready_for_review_metadata" || approval.approvalReadiness === "not_required";
  const rollbackReady =
    rollback.rollbackReadiness === "metadata_ready" || rollback.rollbackReadiness === "not_applicable";
  const auditSufficient =
    audit.auditReadiness === "sufficient_metadata" || audit.auditReadiness === "minimal";
  const actualReleaseEnforcementDisabled = true;
  const actualShellExecutionDisabled = true;

  const rows: { readonly label: string; readonly ok: boolean }[] = [
    { label: "no-op shell hardening final gate ready_metadata", ok: hardeningFinalGateReady },
    { label: "h34 entry readiness ready_metadata", ok: hardeningGate.h34EntryReadiness === "ready_metadata" },
    { label: "hardening readiness verification verified_metadata", ok: hardeningReadinessVerified },
    { label: "hardening alignment aligned_metadata", ok: hardeningAlignmentAligned },
    { label: "no hardening boundary violations", ok: noHardeningBoundaryViolations },
    { label: "no release-gate blockers", ok: noReleaseGateBlockers },
    { label: "no-execution result diagnosticOnly", ok: noopResultDiagnosticOnly },
    { label: "shell safety guard forbids execution", ok: safetyGuardForbidsExecution },
    { label: "operator approval metadata ready", ok: operatorApprovalReady },
    { label: "rollback readiness metadata ready", ok: rollbackReady },
    { label: "audit readiness metadata sufficient", ok: auditSufficient },
    { label: "actual release enforcement disabled", ok: actualReleaseEnforcementDisabled },
    { label: "actual shell execution disabled", ok: actualShellExecutionDisabled },
  ];

  const checklist = mergeSortedUniqueKo(rows.map((r) => `${r.label}:${r.ok}`));
  const missingRows = mergeSortedUniqueKo(rows.filter((r) => !r.ok).map((r) => r.label));

  const blockers: string[] = [];
  if (!hardeningFinalGateReady) {
    blockers.push("hardening final gate not ready_metadata");
  }
  if (!hardeningReadinessVerified) {
    blockers.push("hardening readiness not verified_metadata");
  }
  if (!hardeningAlignmentAligned) {
    blockers.push("hardening alignment not aligned_metadata");
  }
  if (!noHardeningBoundaryViolations) {
    blockers.push("hardening boundary violations present");
  }
  if (!noReleaseGateBlockers) {
    blockers.push(...blockerReport.blockers.slice(0, 2));
  }

  const recommendations = mergeSortedUniqueKo([
    ...(missingRows.length === 0
      ? ["H34: release-gate readiness checklist pass — controlled release-gate candidate(집행 없음)"]
      : ["H34: release-gate readiness checklist incomplete — hardening·approval 정렬"]),
    ...blockerReport.recommendations,
  ]);

  return {
    mode: "runtime_noop_shell_release_gate_readiness_checklist",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
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
