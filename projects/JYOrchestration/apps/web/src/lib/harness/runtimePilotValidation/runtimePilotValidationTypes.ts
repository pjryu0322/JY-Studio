/**
 * Pilot Validation Phase 0 — read-only chain validation summary types.
 */

import type { RuntimePilotExecutionReadinessActualFlagsDisabled } from "@/lib/harness/runtimePilotExecutionReadiness/runtimePilotExecutionReadinessTypes";
import type {
  RuntimeSafeEchoAdapterContractSummary,
  RuntimeSafeEchoAdapterInputContract,
  RuntimeSafeEchoAdapterOutputContract,
  RuntimeSandboxDryRunBoundary,
} from "./runtimeSafeEchoAdapterContractTypes";
import type {
  RuntimePilotValidationAuditTraceCandidate,
  RuntimePilotValidationOperatorApprovalSnapshot,
  RuntimePilotValidationRequestDraft,
  RuntimePilotValidationRollbackPlanCandidate,
} from "./runtimePilotValidationRequestDraftTypes";

export type RuntimePilotValidationReadOnlyChainStatus =
  | "ready_for_validation"
  | "watch"
  | "blocked"
  | "not_ready";

export type RuntimePilotValidationReadOnlyChainSummary = Readonly<
  RuntimePilotExecutionReadinessActualFlagsDisabled & {
    mode: "runtime_pilot_validation_read_only_chain_summary";
    validationStatus: RuntimePilotValidationReadOnlyChainStatus;
    finalGateStatus: string;
    pilotValidationEntryReadiness: string;
    topBlockers: readonly string[];
    topWarnings: readonly string[];
    finalProofSummary: readonly string[];
    userVisibleSummaryKo: string;
    operatorVisibleSummaryKo: string;
    recommendations: readonly string[];
  }
>;

export type RuntimePilotValidationPlanningReports = Readonly<{
  runtimePilotValidationReadOnlyChainSummary: RuntimePilotValidationReadOnlyChainSummary;
  runtimeSafeEchoAdapterContractSummary: RuntimeSafeEchoAdapterContractSummary;
  runtimeSafeEchoAdapterInputContract: RuntimeSafeEchoAdapterInputContract;
  runtimeSafeEchoAdapterOutputContract: RuntimeSafeEchoAdapterOutputContract;
  runtimeSandboxDryRunBoundary: RuntimeSandboxDryRunBoundary;
  runtimePilotValidationRequestDraft: RuntimePilotValidationRequestDraft;
  runtimePilotValidationOperatorApprovalSnapshot: RuntimePilotValidationOperatorApprovalSnapshot;
  runtimePilotValidationAuditTraceCandidate: RuntimePilotValidationAuditTraceCandidate;
  runtimePilotValidationRollbackPlanCandidate: RuntimePilotValidationRollbackPlanCandidate;
}>;
