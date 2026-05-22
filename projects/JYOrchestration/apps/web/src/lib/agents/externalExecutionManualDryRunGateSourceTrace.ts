/**
 * Stage 12-A manual dry-run gate source trace (read-only).
 */

import type { ExternalExecutionDryRunPackageReport } from "@/lib/agents/externalExecutionDryRunPackageTypes";
import type {
  ExternalExecutionManualDryRunGateDecisionInput,
  ExternalExecutionManualDryRunGateReport,
} from "@/lib/agents/externalExecutionManualDryRunGateTypes";

export function mapExternalExecutionManualDryRunGateSourceTrace(
  source: ExternalExecutionDryRunPackageReport,
): Pick<
  ExternalExecutionManualDryRunGateReport,
  | "sourceStage11Decision"
  | "sourceStage12EntryReady"
  | "sourceManualDryRunGateDesignAllowed"
  | "sourceOperatorApprovedDryRunInvocationAllowed"
  | "sourceMockExternalAdapterResultPackageAllowed"
  | "sourceDryRunAuditEventPackageAllowed"
  | "sourceRollbackPlanReviewBeforeActualExecutionAllowed"
  | "sourceStage12ManualGateRequiredBeforeActualExecution"
> {
  return {
    sourceStage11Decision: source.decision,
    sourceStage12EntryReady: source.stage12EntryReady,
    sourceManualDryRunGateDesignAllowed: source.manualDryRunGateDesignAllowed,
    sourceOperatorApprovedDryRunInvocationAllowed: source.operatorApprovedDryRunInvocationAllowed,
    sourceMockExternalAdapterResultPackageAllowed: source.mockExternalAdapterResultPackageAllowed,
    sourceDryRunAuditEventPackageAllowed: source.dryRunAuditEventPackageAllowed,
    sourceRollbackPlanReviewBeforeActualExecutionAllowed: source.rollbackPlanReviewBeforeActualExecutionAllowed,
    sourceStage12ManualGateRequiredBeforeActualExecution: source.stage12ManualGateRequiredBeforeActualExecution,
  };
}

export function mapExternalExecutionManualDryRunGateActualExecutionBoundaryTrace(
  source: ExternalExecutionDryRunPackageReport,
): Pick<
  ExternalExecutionManualDryRunGateDecisionInput,
  | "sourceActualManualExternalInvocationAllowedInThisStep"
  | "sourceActualAdapterSideEffectAllowedInThisStep"
  | "sourceActualAgentRegistryMutationAllowedInThisStep"
> {
  return {
    sourceActualManualExternalInvocationAllowedInThisStep: source.actualManualExternalInvocationAllowedInThisStep,
    sourceActualAdapterSideEffectAllowedInThisStep: source.actualAdapterSideEffectAllowedInThisStep,
    sourceActualAgentRegistryMutationAllowedInThisStep: source.actualAgentRegistryMutationAllowedInThisStep,
  };
}
