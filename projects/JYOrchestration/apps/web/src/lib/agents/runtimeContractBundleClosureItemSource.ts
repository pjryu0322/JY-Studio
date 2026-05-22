/**
 * Stage 7-C bundle item source readiness (read-only).
 */

import type { RuntimeApiContractDesignReport } from "@/lib/agents/runtimeApiContractDesignTypes";

export function isSourceReadyForBundleItems(source: RuntimeApiContractDesignReport): boolean {
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
