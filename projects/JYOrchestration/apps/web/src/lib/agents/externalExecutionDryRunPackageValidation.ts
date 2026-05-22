/**
 * Stage 11-A dry-run package item validation (read-only).
 */

import {
  STAGE11_A_REQUIRED_ITEM_IDS,
  STAGE12_ENTRY_ITEM_ID,
} from "@/lib/agents/externalExecutionDryRunPackageConstants";
import { validateStage12EntryItem } from "@/lib/agents/externalExecutionDryRunPackageStage12EntryValidation";
import type {
  ExternalExecutionDryRunPackageItem,
  ExternalExecutionDryRunPackageValidationResult,
} from "@/lib/agents/externalExecutionDryRunPackageTypes";

function emptyArrays(): Pick<
  ExternalExecutionDryRunPackageValidationResult,
  | "missingItemIds"
  | "duplicateItemIds"
  | "implementedItemIds"
  | "nonDryRunOnlyItemIds"
  | "externalExecutionAllowedItemIds"
  | "cursorExecutionAllowedItemIds"
  | "githubWriteAllowedItemIds"
  | "connectorGatewayCallAllowedItemIds"
  | "dbPersistenceAllowedItemIds"
  | "productionRunnerAllowedItemIds"
  | "uiImplementationAllowedItemIds"
  | "agentRegistryMutationAllowedItemIds"
  | "emptyApprovalItemIds"
  | "emptyForbiddenBoundaryItemIds"
  | "missingStage12CandidateItemIds"
  | "missingRequiredBeforeStage12ItemIds"
> {
  return {
    missingItemIds: [],
    duplicateItemIds: [],
    implementedItemIds: [],
    nonDryRunOnlyItemIds: [],
    externalExecutionAllowedItemIds: [],
    cursorExecutionAllowedItemIds: [],
    githubWriteAllowedItemIds: [],
    connectorGatewayCallAllowedItemIds: [],
    dbPersistenceAllowedItemIds: [],
    productionRunnerAllowedItemIds: [],
    uiImplementationAllowedItemIds: [],
    agentRegistryMutationAllowedItemIds: [],
    emptyApprovalItemIds: [],
    emptyForbiddenBoundaryItemIds: [],
    missingStage12CandidateItemIds: [],
    missingRequiredBeforeStage12ItemIds: [],
  };
}

function emptyInvalidValidation(): ExternalExecutionDryRunPackageValidationResult {
  return {
    valid: false,
    missingItemIds: [...STAGE11_A_REQUIRED_ITEM_IDS],
    duplicateItemIds: [],
    implementedItemIds: [],
    nonDryRunOnlyItemIds: [],
    externalExecutionAllowedItemIds: [],
    cursorExecutionAllowedItemIds: [],
    githubWriteAllowedItemIds: [],
    connectorGatewayCallAllowedItemIds: [],
    dbPersistenceAllowedItemIds: [],
    productionRunnerAllowedItemIds: [],
    uiImplementationAllowedItemIds: [],
    agentRegistryMutationAllowedItemIds: [],
    emptyApprovalItemIds: [],
    emptyForbiddenBoundaryItemIds: [],
    missingStage12CandidateItemIds: [STAGE12_ENTRY_ITEM_ID],
    missingRequiredBeforeStage12ItemIds: [],
  };
}

export function validateExternalExecutionDryRunPackageItems(
  items: readonly ExternalExecutionDryRunPackageItem[],
): ExternalExecutionDryRunPackageValidationResult {
  if (items.length === 0) {
    return emptyInvalidValidation();
  }

  const missingItemIds: string[] = [];
  const duplicateItemIds: string[] = [];
  const implementedItemIds: string[] = [];
  const nonDryRunOnlyItemIds: string[] = [];
  const externalExecutionAllowedItemIds: string[] = [];
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
    if (item.dryRunOnly !== true) {
      nonDryRunOnlyItemIds.push(item.itemId);
    }
    if (item.actualExternalExecutionAllowedInThisStep !== false) {
      externalExecutionAllowedItemIds.push(item.itemId);
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

  for (const requiredId of STAGE11_A_REQUIRED_ITEM_IDS) {
    if (!seen.has(requiredId)) {
      missingItemIds.push(requiredId);
    }
  }

  const stage12Item = items.find((item) => item.itemId === STAGE12_ENTRY_ITEM_ID);
  const stage12Validation = validateStage12EntryItem(stage12Item);

  const valid =
    missingItemIds.length === 0 &&
    duplicateItemIds.length === 0 &&
    implementedItemIds.length === 0 &&
    nonDryRunOnlyItemIds.length === 0 &&
    externalExecutionAllowedItemIds.length === 0 &&
    cursorExecutionAllowedItemIds.length === 0 &&
    githubWriteAllowedItemIds.length === 0 &&
    connectorGatewayCallAllowedItemIds.length === 0 &&
    dbPersistenceAllowedItemIds.length === 0 &&
    productionRunnerAllowedItemIds.length === 0 &&
    uiImplementationAllowedItemIds.length === 0 &&
    agentRegistryMutationAllowedItemIds.length === 0 &&
    emptyForbiddenBoundaryItemIds.length === 0 &&
    emptyApprovalItemIds.length === 0 &&
    stage12Validation.missingStage12CandidateItemIds.length === 0 &&
    stage12Validation.missingRequiredBeforeStage12ItemIds.length === 0;

  if (valid) {
    return { valid: true, ...emptyArrays() };
  }

  return {
    valid: false,
    missingItemIds,
    duplicateItemIds,
    implementedItemIds,
    nonDryRunOnlyItemIds,
    externalExecutionAllowedItemIds,
    cursorExecutionAllowedItemIds,
    githubWriteAllowedItemIds,
    connectorGatewayCallAllowedItemIds,
    dbPersistenceAllowedItemIds,
    productionRunnerAllowedItemIds,
    uiImplementationAllowedItemIds,
    agentRegistryMutationAllowedItemIds,
    emptyApprovalItemIds,
    emptyForbiddenBoundaryItemIds,
    ...stage12Validation,
  };
}

export function computeStage12EntryReady(
  items: readonly ExternalExecutionDryRunPackageItem[],
  validation: ExternalExecutionDryRunPackageValidationResult,
): boolean {
  if (!validation.valid) {
    return false;
  }
  const stage12Item = items.find((item) => item.itemId === STAGE12_ENTRY_ITEM_ID);
  return stage12Item?.stage12Candidate === true && stage12Item.requiredBeforeStage12 === true;
}
