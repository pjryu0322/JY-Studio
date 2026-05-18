/**
 * Pilot Validation Phase 4 — simulator status resolution (read-only).
 */

import type { RuntimeSafeEchoAdapterContractSummary } from "./runtimeSafeEchoAdapterContractTypes";
import type {
  RuntimePilotValidationAuditTraceCandidate,
  RuntimePilotValidationOperatorApprovalSnapshot,
  RuntimePilotValidationRequestDraft,
  RuntimePilotValidationRollbackPlanCandidate,
} from "./runtimePilotValidationRequestDraftTypes";
import type {
  RuntimeSafeEchoInvocationSimulatorMode,
  RuntimeSafeEchoInvocationSimulatorStatus,
} from "./runtimeSafeEchoInvocationSimulatorTypes";

export function resolveRuntimeSafeEchoInvocationSimulatorStatus(input: Readonly<{
  draft: RuntimePilotValidationRequestDraft;
  approvalSnapshot: RuntimePilotValidationOperatorApprovalSnapshot;
  auditTrace: RuntimePilotValidationAuditTraceCandidate;
  rollbackPlan: RuntimePilotValidationRollbackPlanCandidate;
  contract: RuntimeSafeEchoAdapterContractSummary;
}>): RuntimeSafeEchoInvocationSimulatorStatus {
  const { draft, approvalSnapshot, auditTrace, rollbackPlan, contract } = input;

  if (
    draft.draftStatus === "blocked" ||
    approvalSnapshot.approvalSnapshotStatus === "blocked" ||
    auditTrace.auditTraceStatus === "blocked" ||
    rollbackPlan.rollbackPlanStatus === "blocked" ||
    contract.contractStatus === "blocked" ||
    draft.blockers.length > 0
  ) {
    return "blocked";
  }

  if (
    draft.draftStatus === "watch" ||
    approvalSnapshot.approvalSnapshotStatus === "review_required" ||
    auditTrace.auditTraceStatus === "watch" ||
    rollbackPlan.rollbackPlanStatus === "watch" ||
    contract.contractStatus === "watch" ||
    draft.warnings.length > 0
  ) {
    return "watch";
  }

  if (
    draft.draftStatus === "draft_ready" &&
    approvalSnapshot.approvalSnapshotStatus === "approval_snapshot_ready" &&
    auditTrace.auditTraceStatus === "audit_trace_candidate_ready" &&
    rollbackPlan.rollbackPlanStatus === "rollback_plan_candidate_ready" &&
    contract.contractStatus === "contract_ready"
  ) {
    return "simulator_contract_ready";
  }

  return "not_ready";
}

export function resolveRuntimeSafeEchoInvocationSimulatorMode(
  simulatorStatus: RuntimeSafeEchoInvocationSimulatorStatus
): RuntimeSafeEchoInvocationSimulatorMode {
  switch (simulatorStatus) {
    case "simulator_contract_ready":
      return "read_only_echo_simulation_contract";
    case "blocked":
      return "blocked";
    default:
      return "simulator_contract_only";
  }
}
