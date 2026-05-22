/**
 * Stage 11-A manual dry-run gate hardening trace (read-only).
 */

import type { ExternalExecutionAdapterBoundaryReport } from "@/lib/agents/externalExecutionAdapterBoundaryTypes";
import type { ExternalExecutionDryRunPackageReport } from "@/lib/agents/externalExecutionDryRunPackageTypes";

export function mapExternalExecutionDryRunPackageAgentRegistrySourceTrace(
  source: ExternalExecutionAdapterBoundaryReport,
): Pick<
  ExternalExecutionDryRunPackageReport,
  | "sourceAgentRegistryChangeManagementOutOfScope"
  | "sourceAgentAddRemoveDeactivateOutOfScope"
  | "sourceAgentRoleSlotImpactAnalysisRequired"
  | "sourceMandatoryGateAgentDeactivationRequiresApproval"
  | "sourceAgentKnowledgeBindingChangeRequiresApproval"
> {
  return {
    sourceAgentRegistryChangeManagementOutOfScope: source.agentRegistryChangeManagementOutOfScope,
    sourceAgentAddRemoveDeactivateOutOfScope: source.agentAddRemoveDeactivateOutOfScope,
    sourceAgentRoleSlotImpactAnalysisRequired: source.agentRoleSlotImpactAnalysisRequired,
    sourceMandatoryGateAgentDeactivationRequiresApproval: source.mandatoryGateAgentDeactivationRequiresApproval,
    sourceAgentKnowledgeBindingChangeRequiresApproval: source.agentKnowledgeBindingChangeRequiresApproval,
  };
}

export function buildExternalExecutionDryRunPackageManualGateHardeningFields() {
  return {
    manualDryRunGateDesignAllowed: true as const,
    operatorApprovedDryRunInvocationAllowed: true as const,
    mockExternalAdapterResultPackageAllowed: true as const,
    dryRunAuditEventPackageAllowed: true as const,
    rollbackPlanReviewBeforeActualExecutionAllowed: true as const,
    stage12ManualGateRequiredBeforeActualExecution: true as const,
    actualManualExternalInvocationAllowedInThisStep: false as const,
    actualAdapterSideEffectAllowedInThisStep: false as const,
    actualAgentRegistryMutationAllowedInThisStep: false as const,
  };
}
