/**
 * Stage 6-E dry-run contract item builders (read-only).
 */

import type { RuntimeExecutionContractCandidateReport } from "@/lib/agents/runtimeExecutionContractCandidateTypes";
import {
  COMMON_DRY_RUN_BOUNDARY_RULES,
  CONTRACT_ID_TO_DRY_RUN_SPEC,
  REQUIRED_RUNTIME_EXECUTION_DRY_RUN_CONTRACT_IDS,
} from "@/lib/agents/runtimeExecutionDryRunContractConstants";
import type { RuntimeExecutionDryRunContractItem } from "@/lib/agents/runtimeExecutionDryRunContractTypes";

function sourceReadyForDryRunContracts(source: RuntimeExecutionContractCandidateReport): boolean {
  return (
    source.decision === "ready_for_runtime_execution_dry_run_contract" &&
    source.contractCandidateOnly === true &&
    source.sourceNoRunBoundarySatisfied === true &&
    source.sourcePersistenceBoundarySatisfied === true &&
    source.sourceSchemaMigrationBoundarySatisfied === true &&
    source.contractCandidateValidation.valid === true
  );
}

export function buildRuntimeExecutionDryRunContractItems(
  source: RuntimeExecutionContractCandidateReport,
): readonly RuntimeExecutionDryRunContractItem[] {
  if (!sourceReadyForDryRunContracts(source)) {
    return [];
  }

  return source.contractCandidates
    .map((contract) => {
      const spec = CONTRACT_ID_TO_DRY_RUN_SPEC[contract.contractId];
      if (!spec) {
        return null;
      }
      return {
        dryRunContractId: spec.dryRunContractId,
        area: spec.area,
        sourceContractId: contract.contractId,
        scenarioName: spec.scenarioName,
        purpose: `Dry-run scenario for ${contract.contractName}; does not execute runtime.`,
        requiredInputs: [
          `${spec.dryRunContractId}:input:request`,
          `${spec.dryRunContractId}:input:context`,
        ],
        expectedAssertions: [
          `${spec.dryRunContractId}:assert:no_side_effect`,
          `${spec.dryRunContractId}:assert:candidate_only`,
        ],
        boundaryRules: [
          ...COMMON_DRY_RUN_BOUNDARY_RULES,
          `source_contract:${contract.contractId}`,
        ],
        dryRunOnly: true,
        implementedInThisStep: false,
      } satisfies RuntimeExecutionDryRunContractItem;
    })
    .filter((item): item is RuntimeExecutionDryRunContractItem => item !== null);
}

export function validateRuntimeExecutionDryRunContractItems(
  items: readonly RuntimeExecutionDryRunContractItem[],
): boolean {
  if (items.length !== REQUIRED_RUNTIME_EXECUTION_DRY_RUN_CONTRACT_IDS.length) {
    return false;
  }
  const ids = new Set(items.map((item) => item.dryRunContractId));
  if (!REQUIRED_RUNTIME_EXECUTION_DRY_RUN_CONTRACT_IDS.every((id) => ids.has(id))) {
    return false;
  }
  return items.every(
    (item) =>
      item.dryRunOnly === true &&
      item.implementedInThisStep === false &&
      item.requiredInputs.length >= 2 &&
      item.expectedAssertions.length >= 2 &&
      item.boundaryRules.length >= 2,
  );
}
