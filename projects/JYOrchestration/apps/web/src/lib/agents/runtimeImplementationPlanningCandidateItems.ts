/**
 * Stage 7-A implementation planning item builders (read-only).
 */

import type { RuntimeExecutionContractClosureReport } from "@/lib/agents/runtimeExecutionContractClosureTypes";
import {
  STAGE7_A_PLANNING_ITEM_SPECS,
  STAGE7_A_REQUIRED_PLANNING_ITEM_IDS,
} from "@/lib/agents/runtimeImplementationPlanningCandidateConstants";
import type {
  RuntimeImplementationPlanningItem,
  RuntimeImplementationPlanningValidationResult,
} from "@/lib/agents/runtimeImplementationPlanningCandidateTypes";

const VALID_PR_TYPES = new Set<RuntimeImplementationPlanningItem["recommendedPrType"]>([
  "separate_pr",
  "design_pr",
  "approval_pr",
]);

function sourceReadyForPlanningItems(source: RuntimeExecutionContractClosureReport): boolean {
  return (
    source.decision === "stage6_runtime_execution_contract_closed" &&
    source.stage6ContractClosed === true &&
    source.stage6ClosureOnly === true &&
    source.actualRuntimeExecutionAllowedAfterStage6 === false
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

const EMPTY_VALIDATION: RuntimeImplementationPlanningValidationResult = {
  valid: true,
  missingPlanningItemIds: [],
  duplicatePlanningItemIds: [],
  invalidPrTypeItemIds: [],
  emptyApprovalItemIds: [],
  emptyForbiddenBoundaryItemIds: [],
  implementedInThisStepItemIds: [],
};

export function validateRuntimeImplementationPlanningItems(
  items: readonly RuntimeImplementationPlanningItem[],
): RuntimeImplementationPlanningValidationResult {
  if (items.length === 0) {
    return {
      valid: false,
      missingPlanningItemIds: [...STAGE7_A_REQUIRED_PLANNING_ITEM_IDS],
      duplicatePlanningItemIds: [],
      invalidPrTypeItemIds: [],
      emptyApprovalItemIds: [],
      emptyForbiddenBoundaryItemIds: [],
      implementedInThisStepItemIds: [],
    };
  }

  const missingPlanningItemIds: string[] = [];
  const duplicatePlanningItemIds: string[] = [];
  const invalidPrTypeItemIds: string[] = [];
  const emptyApprovalItemIds: string[] = [];
  const emptyForbiddenBoundaryItemIds: string[] = [];
  const implementedInThisStepItemIds: string[] = [];

  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.planningItemId)) {
      duplicatePlanningItemIds.push(item.planningItemId);
    } else {
      seen.add(item.planningItemId);
    }

    if (!VALID_PR_TYPES.has(item.recommendedPrType)) {
      invalidPrTypeItemIds.push(item.planningItemId);
    }
    if (item.requiredApprovals.length < 1) {
      emptyApprovalItemIds.push(item.planningItemId);
    }
    if (item.forbiddenInThisStep.length < 1) {
      emptyForbiddenBoundaryItemIds.push(item.planningItemId);
    }
    if (item.implementedInThisStep !== false) {
      implementedInThisStepItemIds.push(item.planningItemId);
    }
  }

  for (const requiredId of STAGE7_A_REQUIRED_PLANNING_ITEM_IDS) {
    if (!seen.has(requiredId)) {
      missingPlanningItemIds.push(requiredId);
    }
  }

  const valid =
    missingPlanningItemIds.length === 0 &&
    duplicatePlanningItemIds.length === 0 &&
    invalidPrTypeItemIds.length === 0 &&
    emptyApprovalItemIds.length === 0 &&
    emptyForbiddenBoundaryItemIds.length === 0 &&
    implementedInThisStepItemIds.length === 0;

  if (valid) {
    return EMPTY_VALIDATION;
  }

  return {
    valid: false,
    missingPlanningItemIds,
    duplicatePlanningItemIds,
    invalidPrTypeItemIds,
    emptyApprovalItemIds,
    emptyForbiddenBoundaryItemIds,
    implementedInThisStepItemIds,
  };
}
