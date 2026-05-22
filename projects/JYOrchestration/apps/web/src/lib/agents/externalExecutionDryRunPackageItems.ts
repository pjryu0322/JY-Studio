/**
 * Stage 11-A external execution dry-run package items (read-only).
 */

import {
  STAGE11_A_DRY_RUN_ITEM_SPECS,
  STAGE11_A_REQUIRED_ITEM_IDS,
} from "@/lib/agents/externalExecutionDryRunPackageConstants";
import { isSourceReadyForExternalExecutionDryRunPackage } from "@/lib/agents/externalExecutionDryRunPackageSource";
import type { ExternalExecutionAdapterBoundaryReport } from "@/lib/agents/externalExecutionAdapterBoundaryTypes";
import type { ExternalExecutionDryRunPackageItem } from "@/lib/agents/externalExecutionDryRunPackageTypes";

export function buildExternalExecutionDryRunPackageItems(
  source: ExternalExecutionAdapterBoundaryReport,
): readonly ExternalExecutionDryRunPackageItem[] {
  if (!isSourceReadyForExternalExecutionDryRunPackage(source)) {
    return [];
  }

  return STAGE11_A_REQUIRED_ITEM_IDS.map((itemId) => {
    const spec = STAGE11_A_DRY_RUN_ITEM_SPECS[itemId];
    return {
      itemId,
      area: spec.area,
      title: spec.title,
      purpose: spec.purpose,
      source: "stage10_a_external_execution_adapter_boundary" as const,
      dryRunOnly: true as const,
      implementedInThisStep: false as const,
      actualExternalExecutionAllowedInThisStep: false as const,
      actualCursorExecutionAllowedInThisStep: false as const,
      actualGithubWriteAllowedInThisStep: false as const,
      actualConnectorGatewayCallAllowedInThisStep: false as const,
      actualDbPersistenceAllowedInThisStep: false as const,
      actualProductionRunnerAllowedInThisStep: false as const,
      actualUiImplementationAllowedInThisStep: false as const,
      agentRegistryMutationAllowedInThisStep: false as const,
      stage12Candidate: spec.stage12Candidate,
      requiredBeforeStage12: spec.requiredBeforeStage12,
      forbiddenInThisStep: [...spec.forbiddenInThisStep],
      requiredApprovals: [...spec.requiredApprovals],
    };
  });
}
