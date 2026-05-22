/**
 * Stage 12-A manual dry-run gate item validation (read-only).
 */

import {
  STAGE12_A_REQUIRED_ITEM_IDS,
  STAGE13_ENTRY_ITEM_ID,
} from "@/lib/agents/externalExecutionManualDryRunGateConstants";
import { validateStage13EntryItem } from "@/lib/agents/externalExecutionManualDryRunGateStage13EntryValidation";
import type {
  ExternalExecutionManualDryRunGateItem,
  ExternalExecutionManualDryRunGateValidationResult,
} from "@/lib/agents/externalExecutionManualDryRunGateTypes";

function emptyArrays(): Pick<
  ExternalExecutionManualDryRunGateValidationResult,
  | "missingItemIds"
  | "duplicateItemIds"
  | "implementedItemIds"
  | "nonManualGateOnlyItemIds"
  | "externalInvocationAllowedItemIds"
  | "adapterSideEffectAllowedItemIds"
  | "cursorExecutionAllowedItemIds"
  | "githubWriteAllowedItemIds"
  | "connectorGatewayCallAllowedItemIds"
  | "dbPersistenceAllowedItemIds"
  | "productionRunnerAllowedItemIds"
  | "uiImplementationAllowedItemIds"
  | "agentRegistryMutationAllowedItemIds"
  | "emptyApprovalItemIds"
  | "emptyForbiddenBoundaryItemIds"
  | "missingStage13CandidateItemIds"
  | "missingRequiredBeforeStage13ItemIds"
> {
  return {
    missingItemIds: [],
    duplicateItemIds: [],
    implementedItemIds: [],
    nonManualGateOnlyItemIds: [],
    externalInvocationAllowedItemIds: [],
    adapterSideEffectAllowedItemIds: [],
    cursorExecutionAllowedItemIds: [],
    githubWriteAllowedItemIds: [],
    connectorGatewayCallAllowedItemIds: [],
    dbPersistenceAllowedItemIds: [],
    productionRunnerAllowedItemIds: [],
    uiImplementationAllowedItemIds: [],
    agentRegistryMutationAllowedItemIds: [],
    emptyApprovalItemIds: [],
    emptyForbiddenBoundaryItemIds: [],
    missingStage13CandidateItemIds: [],
    missingRequiredBeforeStage13ItemIds: [],
  };
}

function emptyInvalidValidation(): ExternalExecutionManualDryRunGateValidationResult {
  return {
    valid: false,
    missingItemIds: [...STAGE12_A_REQUIRED_ITEM_IDS],
    duplicateItemIds: [],
    implementedItemIds: [],
    nonManualGateOnlyItemIds: [],
    externalInvocationAllowedItemIds: [],
    adapterSideEffectAllowedItemIds: [],
    cursorExecutionAllowedItemIds: [],
    githubWriteAllowedItemIds: [],
    connectorGatewayCallAllowedItemIds: [],
    dbPersistenceAllowedItemIds: [],
    productionRunnerAllowedItemIds: [],
    uiImplementationAllowedItemIds: [],
    agentRegistryMutationAllowedItemIds: [],
    emptyApprovalItemIds: [],
    emptyForbiddenBoundaryItemIds: [],
    missingStage13CandidateItemIds: [STAGE13_ENTRY_ITEM_ID],
    missingRequiredBeforeStage13ItemIds: [],
  };
}

export function validateExternalExecutionManualDryRunGateItems(
  items: readonly ExternalExecutionManualDryRunGateItem[],
): ExternalExecutionManualDryRunGateValidationResult {
  if (items.length === 0) {
    return emptyInvalidValidation();
  }

  const missingItemIds: string[] = [];
  const duplicateItemIds: string[] = [];
  const implementedItemIds: string[] = [];
  const nonManualGateOnlyItemIds: string[] = [];
  const externalInvocationAllowedItemIds: string[] = [];
  const adapterSideEffectAllowedItemIds: string[] = [];
  const cursorExecutionAllowedItemIds: string[] = [];
  const githubWriteAllowedItemIds: string[] = [];
  const connectorGatewayCallAllowedItemIds: string[] = [];
  const dbPersistenceAllowedItemIds: string[] = [];
  const productionRunnerAllowedItemIds: string[] = [];
  const uiImplementationAllowedItemIds: string[] = [];
  const agentRegistryMutationAllowedItemIds: string[] = [];
  const emptyForbiddenBoundaryItemIds: string[] = [];
  const emptyApprovalItemIds: string[] = [];

  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.itemId)) {
      duplicateItemIds.push(item.itemId);
    } else {
      seen.add(item.itemId);
    }

    if (item.implementedInThisStep !== false) {
      implementedItemIds.push(item.itemId);
    }
    if (item.manualGateOnly !== true) {
      nonManualGateOnlyItemIds.push(item.itemId);
    }
    if (item.actualExternalInvocationAllowedInThisStep !== false) {
      externalInvocationAllowedItemIds.push(item.itemId);
    }
    if (item.actualAdapterSideEffectAllowedInThisStep !== false) {
      adapterSideEffectAllowedItemIds.push(item.itemId);
    }
    if (item.actualCursorExecutionAllowedInThisStep !== false) {
      cursorExecutionAllowedItemIds.push(item.itemId);
    }
    if (item.actualGithubWriteAllowedInThisStep !== false) {
      githubWriteAllowedItemIds.push(item.itemId);
    }
    if (item.actualConnectorGatewayCallAllowedInThisStep !== false) {
      connectorGatewayCallAllowedItemIds.push(item.itemId);
    }
    if (item.actualDbPersistenceAllowedInThisStep !== false) {
      dbPersistenceAllowedItemIds.push(item.itemId);
    }
    if (item.actualProductionRunnerAllowedInThisStep !== false) {
      productionRunnerAllowedItemIds.push(item.itemId);
    }
    if (item.actualUiImplementationAllowedInThisStep !== false) {
      uiImplementationAllowedItemIds.push(item.itemId);
    }
    if (item.agentRegistryMutationAllowedInThisStep !== false) {
      agentRegistryMutationAllowedItemIds.push(item.itemId);
    }
    if (item.forbiddenInThisStep.length < 1) {
      emptyForbiddenBoundaryItemIds.push(item.itemId);
    }
    if (item.requiredApprovals.length < 1) {
      emptyApprovalItemIds.push(item.itemId);
    }
  }

  for (const requiredId of STAGE12_A_REQUIRED_ITEM_IDS) {
    if (!seen.has(requiredId)) {
      missingItemIds.push(requiredId);
    }
  }

  const stage13Item = items.find((item) => item.itemId === STAGE13_ENTRY_ITEM_ID);
  const stage13Validation = validateStage13EntryItem(stage13Item);

  const valid =
    missingItemIds.length === 0 &&
    duplicateItemIds.length === 0 &&
    implementedItemIds.length === 0 &&
    nonManualGateOnlyItemIds.length === 0 &&
    externalInvocationAllowedItemIds.length === 0 &&
    adapterSideEffectAllowedItemIds.length === 0 &&
    cursorExecutionAllowedItemIds.length === 0 &&
    githubWriteAllowedItemIds.length === 0 &&
    connectorGatewayCallAllowedItemIds.length === 0 &&
    dbPersistenceAllowedItemIds.length === 0 &&
    productionRunnerAllowedItemIds.length === 0 &&
    uiImplementationAllowedItemIds.length === 0 &&
    agentRegistryMutationAllowedItemIds.length === 0 &&
    emptyForbiddenBoundaryItemIds.length === 0 &&
    emptyApprovalItemIds.length === 0 &&
    stage13Validation.missingStage13CandidateItemIds.length === 0 &&
    stage13Validation.missingRequiredBeforeStage13ItemIds.length === 0;

  if (valid) {
    return { valid: true, ...emptyArrays() };
  }

  return {
    valid: false,
    missingItemIds,
    duplicateItemIds,
    implementedItemIds,
    nonManualGateOnlyItemIds,
    externalInvocationAllowedItemIds,
    adapterSideEffectAllowedItemIds,
    cursorExecutionAllowedItemIds,
    githubWriteAllowedItemIds,
    connectorGatewayCallAllowedItemIds,
    dbPersistenceAllowedItemIds,
    productionRunnerAllowedItemIds,
    uiImplementationAllowedItemIds,
    agentRegistryMutationAllowedItemIds,
    emptyApprovalItemIds,
    emptyForbiddenBoundaryItemIds,
    ...stage13Validation,
  };
}

export function computeStage13EntryReady(
  items: readonly ExternalExecutionManualDryRunGateItem[],
  validation: ExternalExecutionManualDryRunGateValidationResult,
): boolean {
  if (!validation.valid) {
    return false;
  }
  const stage13Item = items.find((item) => item.itemId === STAGE13_ENTRY_ITEM_ID);
  return stage13Item?.stage13Candidate === true && stage13Item.requiredBeforeStage13 === true;
}
