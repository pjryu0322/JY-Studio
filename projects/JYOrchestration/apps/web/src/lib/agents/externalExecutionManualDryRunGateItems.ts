/**
 * Stage 12-A manual dry-run gate items (read-only).
 */

import {
  STAGE12_A_GATE_ITEM_SPECS,
  STAGE12_A_REQUIRED_ITEM_IDS,
} from "@/lib/agents/externalExecutionManualDryRunGateConstants";
import { isSourceReadyForExternalExecutionManualDryRunGate } from "@/lib/agents/externalExecutionManualDryRunGateItemSource";
import type { ExternalExecutionDryRunPackageReport } from "@/lib/agents/externalExecutionDryRunPackageTypes";
import type { ExternalExecutionManualDryRunGateItem } from "@/lib/agents/externalExecutionManualDryRunGateTypes";

export function buildExternalExecutionManualDryRunGateItems(
  source: ExternalExecutionDryRunPackageReport,
): readonly ExternalExecutionManualDryRunGateItem[] {
  if (!isSourceReadyForExternalExecutionManualDryRunGate(source)) {
    return [];
  }

  return STAGE12_A_REQUIRED_ITEM_IDS.map((itemId) => {
    const spec = STAGE12_A_GATE_ITEM_SPECS[itemId];
    return {
      itemId,
      area: spec.area,
      title: spec.title,
      purpose: spec.purpose,
      source: "stage11_a_external_execution_dry_run_package" as const,
      manualGateOnly: true as const,
      implementedInThisStep: false as const,
      actualExternalInvocationAllowedInThisStep: false as const,
      actualAdapterSideEffectAllowedInThisStep: false as const,
      actualCursorExecutionAllowedInThisStep: false as const,
      actualGithubWriteAllowedInThisStep: false as const,
      actualConnectorGatewayCallAllowedInThisStep: false as const,
      actualDbPersistenceAllowedInThisStep: false as const,
      actualProductionRunnerAllowedInThisStep: false as const,
      actualUiImplementationAllowedInThisStep: false as const,
      agentRegistryMutationAllowedInThisStep: false as const,
      stage13Candidate: spec.stage13Candidate,
      requiredBeforeStage13: spec.requiredBeforeStage13,
      forbiddenInThisStep: [...spec.forbiddenInThisStep],
      requiredApprovals: [...spec.requiredApprovals],
    };
  });
}
