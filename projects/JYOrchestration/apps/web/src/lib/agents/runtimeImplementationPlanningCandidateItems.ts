/**
 * Stage 7-A implementation planning item builders (read-only).
 */

import type { RuntimeExecutionContractClosureReport } from "@/lib/agents/runtimeExecutionContractClosureTypes";
import {
  STAGE7_A_PLANNING_ITEM_SPECS,
  STAGE7_A_REQUIRED_PLANNING_ITEM_IDS,
} from "@/lib/agents/runtimeImplementationPlanningCandidateConstants";
import type { RuntimeImplementationPlanningItem } from "@/lib/agents/runtimeImplementationPlanningCandidateTypes";

export { validateRuntimeImplementationPlanningItems } from "@/lib/agents/runtimeImplementationPlanningCandidateValidation";

function sourceActualBoundariesSatisfied(source: RuntimeExecutionContractClosureReport): boolean {
  return (
    source.actualRuntimeExecutionAllowedInThisStep === false &&
    source.actualExecutionRunnerAllowedInThisStep === false &&
    source.actualDryRunRunnerAllowedInThisStep === false &&
    source.actualExecutionWireAllowedInThisStep === false &&
    source.actualPersistenceAllowedInThisStep === false &&
    source.actualExternalSideEffectAllowedInThisStep === false &&
    source.actualSchemaMigrationAllowedInThisStep === false &&
    source.actualCursorGithubWireAllowedInThisStep === false &&
    source.actualConnectorRoutingChangeAllowedInThisStep === false
  );
}

function sourceReadyForPlanningItems(source: RuntimeExecutionContractClosureReport): boolean {
  return (
    source.decision === "stage6_runtime_execution_contract_closed" &&
    source.stage6ContractClosed === true &&
    source.stage6ClosureOnly === true &&
    source.actualRuntimeExecutionAllowedAfterStage6 === false &&
    sourceActualBoundariesSatisfied(source)
  );
}

export function buildRuntimeImplementationPlanningItems(
  source: RuntimeExecutionContractClosureReport,
): readonly RuntimeImplementationPlanningItem[] {
  if (!sourceReadyForPlanningItems(source)) {
    return [];
  }

  return STAGE7_A_REQUIRED_PLANNING_ITEM_IDS.map((planningItemId) => {
    const spec = STAGE7_A_PLANNING_ITEM_SPECS[planningItemId];
    return {
      planningItemId,
      area: spec.area,
      title: spec.title,
      purpose: spec.purpose,
      recommendedPrType: spec.recommendedPrType,
      dependsOn: [...spec.dependsOn],
      requiredApprovals: [...spec.requiredApprovals],
      forbiddenInThisStep: [...spec.forbiddenInThisStep],
      candidateOnly: true as const,
      implementedInThisStep: false as const,
    };
  });
}
