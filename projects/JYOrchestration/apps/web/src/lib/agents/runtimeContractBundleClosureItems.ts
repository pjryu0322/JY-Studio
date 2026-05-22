/**
 * Stage 7-C contract bundle item builders (read-only).
 */

import type { RuntimeApiContractDesignReport } from "@/lib/agents/runtimeApiContractDesignTypes";
import {
  STAGE7_C_BUNDLE_ITEM_SPECS,
  STAGE7_C_REQUIRED_BUNDLE_ITEM_IDS,
} from "@/lib/agents/runtimeContractBundleClosureConstants";
import type { RuntimeContractBundleItem } from "@/lib/agents/runtimeContractBundleClosureTypes";

function sourceReadyForBundleItems(source: RuntimeApiContractDesignReport): boolean {
  return (
    source.decision === "ready_for_execution_runner_contract_design" &&
    source.apiContractDesignOnly === true &&
    source.endpointContractCount >= 6 &&
    source.endpointDesignOnlyCount === source.endpointContractCount &&
    source.implementedEndpointCount === 0 &&
    source.actualApiEndpointImplementedInThisStep === false &&
    source.actualRuntimeExecutionAllowedInThisStep === false &&
    source.actualExecutionRunnerAllowedInThisStep === false &&
    source.actualDryRunRunnerAllowedInThisStep === false &&
    source.actualExecutionWireAllowedInThisStep === false &&
    source.actualPersistenceAllowedInThisStep === false &&
    source.actualSchemaMigrationAllowedInThisStep === false &&
    source.actualCursorGithubWireAllowedInThisStep === false &&
    source.actualConnectorRoutingChangeAllowedInThisStep === false &&
    source.sourceActualExternalSideEffectAllowedInThisStep === false &&
    source.sourceActualUiImplementationAllowedInThisStep === false
  );
}

export function buildRuntimeContractBundleItems(
  source: RuntimeApiContractDesignReport,
): readonly RuntimeContractBundleItem[] {
  if (!sourceReadyForBundleItems(source)) {
    return [];
  }

  return STAGE7_C_REQUIRED_BUNDLE_ITEM_IDS.map((bundleItemId) => {
    const spec = STAGE7_C_BUNDLE_ITEM_SPECS[bundleItemId];
    return {
      bundleItemId,
      area: spec.area,
      title: spec.title,
      purpose: spec.purpose,
      source: spec.source,
      designOnly: true as const,
      implementedInThisStep: false as const,
      stage8Candidate: spec.stage8Candidate,
      requiredBeforeStage8: spec.requiredBeforeStage8,
      forbiddenInThisStep: [...spec.forbiddenInThisStep],
      requiredApprovals: [...spec.requiredApprovals],
    };
  });
}
