/**
 * Stage 6-E dry-run contract item builders (read-only).
 */

import type { RuntimeExecutionContractCandidateReport } from "@/lib/agents/runtimeExecutionContractCandidateTypes";
import {
  COMMON_DRY_RUN_BOUNDARY_RULES,
  CONTRACT_ID_TO_DRY_RUN_SPEC,
  REQUIRED_RUNTIME_EXECUTION_DRY_RUN_CONTRACT_IDS,
} from "@/lib/agents/runtimeExecutionDryRunContractConstants";
import type {
  RuntimeExecutionDryRunContractItem,
  RuntimeExecutionDryRunContractValidationResult,
} from "@/lib/agents/runtimeExecutionDryRunContractTypes";

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

  const items: RuntimeExecutionDryRunContractItem[] = [];
  for (const contract of source.contractCandidates) {
    const spec = CONTRACT_ID_TO_DRY_RUN_SPEC[contract.contractId];
    if (!spec) continue;
    items.push({
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
      boundaryRules: [...COMMON_DRY_RUN_BOUNDARY_RULES, `source_contract:${contract.contractId}`],
      dryRunOnly: true,
      implementedInThisStep: false,
    });
  }
  return items;
}

const EMPTY_VALIDATION: RuntimeExecutionDryRunContractValidationResult = {
  valid: true,
  missingDryRunContractIds: [],
  duplicateDryRunContractIds: [],
  emptyRequiredInputContractIds: [],
  insufficientAssertionContractIds: [],
  invalidBoundaryRuleContractIds: [],
  implementedInThisStepContractIds: [],
};

export function validateRuntimeExecutionDryRunContractItemDetails(
  items: readonly RuntimeExecutionDryRunContractItem[],
): RuntimeExecutionDryRunContractValidationResult {
  const missingDryRunContractIds: string[] = [];
  const duplicateDryRunContractIds: string[] = [];
  const emptyRequiredInputContractIds: string[] = [];
  const insufficientAssertionContractIds: string[] = [];
  const invalidBoundaryRuleContractIds: string[] = [];
  const implementedInThisStepContractIds: string[] = [];

  const idCounts = new Map<string, number>();
  for (const item of items) {
    idCounts.set(item.dryRunContractId, (idCounts.get(item.dryRunContractId) ?? 0) + 1);
  }

  for (const requiredId of REQUIRED_RUNTIME_EXECUTION_DRY_RUN_CONTRACT_IDS) {
    if (!idCounts.has(requiredId)) {
      missingDryRunContractIds.push(requiredId);
    }
  }

  for (const [dryRunContractId, count] of idCounts) {
    if (count > 1) {
      duplicateDryRunContractIds.push(dryRunContractId);
    }
  }

  for (const item of items) {
    if (item.requiredInputs.length < 2) {
      emptyRequiredInputContractIds.push(item.dryRunContractId);
    }
    if (item.expectedAssertions.length < 2) {
      insufficientAssertionContractIds.push(item.dryRunContractId);
    }
    if (item.boundaryRules.length < 2) {
      invalidBoundaryRuleContractIds.push(item.dryRunContractId);
    }
    if (item.dryRunOnly !== true) {
      invalidBoundaryRuleContractIds.push(item.dryRunContractId);
    }
    if (item.implementedInThisStep !== false) {
      implementedInThisStepContractIds.push(item.dryRunContractId);
    }
  }

  const valid =
    items.length === REQUIRED_RUNTIME_EXECUTION_DRY_RUN_CONTRACT_IDS.length &&
    missingDryRunContractIds.length === 0 &&
    duplicateDryRunContractIds.length === 0 &&
    emptyRequiredInputContractIds.length === 0 &&
    insufficientAssertionContractIds.length === 0 &&
    invalidBoundaryRuleContractIds.length === 0 &&
    implementedInThisStepContractIds.length === 0;

  if (valid) {
    return EMPTY_VALIDATION;
  }

  return {
    valid: false,
    missingDryRunContractIds,
    duplicateDryRunContractIds,
    emptyRequiredInputContractIds,
    insufficientAssertionContractIds,
    invalidBoundaryRuleContractIds,
    implementedInThisStepContractIds,
  };
}

export function validateRuntimeExecutionDryRunContractItems(
  items: readonly RuntimeExecutionDryRunContractItem[],
): boolean {
  return validateRuntimeExecutionDryRunContractItemDetails(items).valid;
}
