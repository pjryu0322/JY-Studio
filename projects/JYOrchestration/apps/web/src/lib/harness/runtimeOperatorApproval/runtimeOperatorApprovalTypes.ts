/**
 * H23.5 — Operator **approval·rollback·audit readiness** metadata(read-only; 실제 승인·rollback·pilot 없음).
 */

import type { RuntimeControlBoundaryLevel } from "@/lib/harness/runtimeControlBoundary/runtimeControlBoundaryTypes";
import type { RuntimeExecutionCandidateStatus } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateTypes";

export type RuntimeOperatorApprovalReadiness =
  | "not_required"
  | "ready_for_review_metadata"
  | "review_required"
  | "blocked";

export type RuntimeRollbackReadiness = "not_applicable" | "metadata_ready" | "metadata_watch" | "blocked";

export type RuntimeAuditReadiness = "minimal" | "sufficient_metadata" | "watch" | "blocked";

export type RuntimePilotPreconditionReadiness = "not_ready" | "metadata_only" | "watch" | "blocked";

export type RuntimeOperatorApprovalSummary = Readonly<{
  mode: "runtime_operator_approval_summary";
  actualRuntimeOrchestrationEnabled: false;
  actualApprovalEnforcementEnabled: false;
  actualRollbackExecutionEnabled: false;
  approvalReadiness: RuntimeOperatorApprovalReadiness;
  requiredReviewItems: readonly string[];
  approvalBlockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeRollbackReadinessSummary = Readonly<{
  mode: "runtime_rollback_readiness_summary";
  actualRuntimeOrchestrationEnabled: false;
  actualApprovalEnforcementEnabled: false;
  actualRollbackExecutionEnabled: false;
  rollbackReadiness: RuntimeRollbackReadiness;
  rollbackPrerequisites: readonly string[];
  rollbackBlockers: readonly string[];
  rollbackAuditTrailHints: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeAuditReadinessSummary = Readonly<{
  mode: "runtime_audit_readiness_summary";
  actualRuntimeOrchestrationEnabled: false;
  actualApprovalEnforcementEnabled: false;
  actualRollbackExecutionEnabled: false;
  auditReadiness: RuntimeAuditReadiness;
  auditFindings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePilotPreconditionSummary = Readonly<{
  mode: "runtime_pilot_precondition_summary";
  actualRuntimeOrchestrationEnabled: false;
  actualApprovalEnforcementEnabled: false;
  actualRollbackExecutionEnabled: false;
  pilotPreconditionReadiness: RuntimePilotPreconditionReadiness;
  approvalReadiness: RuntimeOperatorApprovalReadiness;
  rollbackReadiness: RuntimeRollbackReadiness;
  auditReadiness: RuntimeAuditReadiness;
  executionCandidateStatus: RuntimeExecutionCandidateStatus;
  controlBoundaryLevel: RuntimeControlBoundaryLevel;
  actualControlForbiddenMaintained: boolean;
  preconditionNotes: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeOperatorApprovalPlanningReports = Readonly<{
  runtimeOperatorApprovalSummary: RuntimeOperatorApprovalSummary;
  runtimeRollbackReadinessSummary: RuntimeRollbackReadinessSummary;
  runtimeAuditReadinessSummary: RuntimeAuditReadinessSummary;
  runtimePilotPreconditionSummary: RuntimePilotPreconditionSummary;
}>;
