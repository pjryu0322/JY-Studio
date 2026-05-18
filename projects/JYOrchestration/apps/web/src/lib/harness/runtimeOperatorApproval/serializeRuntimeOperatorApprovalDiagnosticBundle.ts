/**
 * H23.5 — operator approval·rollback·audit·pilot precondition 진단 **직렬화 전용**.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeAuditReadinessSummary,
  RuntimeOperatorApprovalSummary,
  RuntimePilotPreconditionSummary,
  RuntimeRollbackReadinessSummary,
} from "./runtimeOperatorApprovalTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

function serializeApproval(s: RuntimeOperatorApprovalSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    actualRuntimeOrchestrationEnabled: s.actualRuntimeOrchestrationEnabled,
    actualApprovalEnforcementEnabled: s.actualApprovalEnforcementEnabled,
    actualRollbackExecutionEnabled: s.actualRollbackExecutionEnabled,
    approvalReadiness: s.approvalReadiness,
    requiredReviewItems: sortKo(s.requiredReviewItems),
    approvalBlockers: sortKo(s.approvalBlockers),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeRollback(s: RuntimeRollbackReadinessSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    actualRuntimeOrchestrationEnabled: s.actualRuntimeOrchestrationEnabled,
    actualApprovalEnforcementEnabled: s.actualApprovalEnforcementEnabled,
    actualRollbackExecutionEnabled: s.actualRollbackExecutionEnabled,
    rollbackReadiness: s.rollbackReadiness,
    rollbackPrerequisites: sortKo(s.rollbackPrerequisites),
    rollbackBlockers: sortKo(s.rollbackBlockers),
    rollbackAuditTrailHints: sortKo(s.rollbackAuditTrailHints),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeAudit(s: RuntimeAuditReadinessSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    actualRuntimeOrchestrationEnabled: s.actualRuntimeOrchestrationEnabled,
    actualApprovalEnforcementEnabled: s.actualApprovalEnforcementEnabled,
    actualRollbackExecutionEnabled: s.actualRollbackExecutionEnabled,
    auditReadiness: s.auditReadiness,
    auditFindings: sortKo(s.auditFindings),
    recommendations: sortKo(s.recommendations),
  };
}

function serializePilot(s: RuntimePilotPreconditionSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    actualRuntimeOrchestrationEnabled: s.actualRuntimeOrchestrationEnabled,
    actualApprovalEnforcementEnabled: s.actualApprovalEnforcementEnabled,
    actualRollbackExecutionEnabled: s.actualRollbackExecutionEnabled,
    pilotPreconditionReadiness: s.pilotPreconditionReadiness,
    approvalReadiness: s.approvalReadiness,
    rollbackReadiness: s.rollbackReadiness,
    auditReadiness: s.auditReadiness,
    executionCandidateStatus: s.executionCandidateStatus,
    controlBoundaryLevel: s.controlBoundaryLevel,
    actualControlForbiddenMaintained: s.actualControlForbiddenMaintained,
    preconditionNotes: sortKo(s.preconditionNotes),
    recommendations: sortKo(s.recommendations),
  };
}

export function serializeRuntimeOperatorApprovalDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeOperatorApprovalSummary: ReturnType<typeof serializeApproval>;
  runtimeRollbackReadinessSummary: ReturnType<typeof serializeRollback>;
  runtimeAuditReadinessSummary: ReturnType<typeof serializeAudit>;
  runtimePilotPreconditionSummary: ReturnType<typeof serializePilot>;
}> {
  return {
    runtimeOperatorApprovalSummary: serializeApproval(reports.runtimeOperatorApprovalSummary),
    runtimeRollbackReadinessSummary: serializeRollback(reports.runtimeRollbackReadinessSummary),
    runtimeAuditReadinessSummary: serializeAudit(reports.runtimeAuditReadinessSummary),
    runtimePilotPreconditionSummary: serializePilot(reports.runtimePilotPreconditionSummary),
  };
}
