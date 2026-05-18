/**
 * H29 — runner invocation **readiness checklist**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeRunnerInvocation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type {
  RuntimeRunnerInvocationBlockerReport,
  RuntimeRunnerInvocationReadinessChecklist,
} from "./runtimeRunnerInvocationTypes";

export function buildRuntimeRunnerInvocationReadinessChecklist(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeRunnerInvocation;
  readonly blockerReport: RuntimeRunnerInvocationBlockerReport;
}): RuntimeRunnerInvocationReadinessChecklist {
  const { reports, blockerReport } = input;
  const preflight = reports.runtimePilotSkeletonPreflightSummary;
  const contractVerification = reports.runtimePilotRunnerContractVerificationReport;
  const boundary = reports.runtimePilotRunnerBoundaryViolationReport;
  const noExecution = reports.runtimePilotRunnerNoExecutionResultMetadata;
  const guard = reports.runtimePilotRunnerSafetyGuard;
  const approval = reports.runtimeOperatorApprovalSummary;
  const rollback = reports.runtimeRollbackReadinessSummary;
  const audit = reports.runtimeAuditReadinessSummary;

  const skeletonPreflightReady = preflight.preflightReadiness === "ready_metadata";
  const contractVerified = contractVerification.verificationStatus === "verified_metadata";
  const noRunnerBoundaryViolations = boundary.actualFlagViolations.length === 0;
  const noInvocationBlockers = blockerReport.blockers.length === 0;
  const noExecutionDiagnosticOnly = noExecution.diagnosticOnly === true;
  const safetyGuardForbidsExecution = guard.actualExecutionForbidden === true;
  const operatorApprovalReady =
    approval.approvalReadiness === "ready_for_review_metadata" ||
    approval.approvalReadiness === "not_required";
  const rollbackReady =
    rollback.rollbackReadiness === "metadata_ready" || rollback.rollbackReadiness === "not_applicable";
  const auditSufficient =
    audit.auditReadiness === "sufficient_metadata" || audit.auditReadiness === "minimal";

  const rows: { readonly label: string; readonly ok: boolean }[] = [
    { label: "pilot skeleton preflight ready_metadata", ok: skeletonPreflightReady },
    { label: "runner contract verification verified_metadata", ok: contractVerified },
    { label: "no runner boundary violations", ok: noRunnerBoundaryViolations },
    { label: "no invocation blockers", ok: noInvocationBlockers },
    { label: "runner no-execution result diagnosticOnly", ok: noExecutionDiagnosticOnly },
    { label: "runner safety guard forbids execution", ok: safetyGuardForbidsExecution },
    { label: "operator approval metadata ready", ok: operatorApprovalReady },
    { label: "rollback readiness metadata ready", ok: rollbackReady },
    { label: "audit readiness metadata sufficient", ok: auditSufficient },
    { label: "actual invocation disabled", ok: true },
  ];

  const checklist = mergeSortedUniqueKo(rows.map((r) => `${r.label}:${r.ok}`));
  const missingRows = mergeSortedUniqueKo(rows.filter((r) => !r.ok).map((r) => r.label));

  const blockers: string[] = [];
  if (!skeletonPreflightReady) {
    blockers.push("pilot skeleton preflight not ready_metadata");
  }
  if (!contractVerified) {
    blockers.push("runner contract not verified_metadata");
  }
  if (!noRunnerBoundaryViolations) {
    blockers.push("runner boundary violations present");
  }
  if (!noInvocationBlockers) {
    blockers.push(...blockerReport.blockers.slice(0, 2));
  }

  const recommendations = mergeSortedUniqueKo([
    ...(missingRows.length === 0
      ? ["H29: runner invocation readiness checklist pass — isolated dry-run invocation candidate(실행 없음)"]
      : ["H29: runner invocation readiness checklist incomplete — skeleton·contract·approval 정렬"]),
    ...blockerReport.recommendations,
  ]);

  return {
    mode: "runtime_runner_invocation_readiness_checklist",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerInvocationEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerInvocationEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
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
