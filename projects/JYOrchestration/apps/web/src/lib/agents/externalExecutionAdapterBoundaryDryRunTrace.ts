/**
 * Stage 10-A dry-run package and agent registry hardening trace (read-only).
 */

import type { ExternalExecutionAdapterBoundaryItem } from "@/lib/agents/externalExecutionAdapterBoundaryTypes";

const EXTERNAL_ADAPTER_CONTRACT_AREAS = [
  "external_adapter_contract",
  "cursor_github_boundary",
  "connector_gateway_boundary",
  "runner_process_boundary",
] as const;

export function countExternalAdapterContractAreas(
  boundaryItems: readonly ExternalExecutionAdapterBoundaryItem[],
): number {
  return boundaryItems.filter((item) =>
    (EXTERNAL_ADAPTER_CONTRACT_AREAS as readonly string[]).includes(item.area),
  ).length;
}

export function buildExternalExecutionAdapterBoundaryDryRunHardeningFields(input: {
  readonly boundaryItems: readonly ExternalExecutionAdapterBoundaryItem[];
}) {
  return {
    dryRunPackageDesignAllowed: true as const,
    dryRunSimulationOnly: true as const,
    externalAdapterContractCount: countExternalAdapterContractAreas(input.boundaryItems),
    stage11DryRunPackageRequiredBeforeActualExecution: true as const,
    agentRegistryChangeManagementOutOfScope: true as const,
    agentAddRemoveDeactivateOutOfScope: true as const,
    agentRoleSlotImpactAnalysisRequired: true as const,
    mandatoryGateAgentDeactivationRequiresApproval: true as const,
    agentKnowledgeBindingChangeRequiresApproval: true as const,
  };
}
