/**
 * Stage 10-A external execution adapter boundary item validation (read-only).
 */

import {
  STAGE10_A_REQUIRED_ITEM_IDS,
  STAGE11_ENTRY_ITEM_ID,
} from "@/lib/agents/externalExecutionAdapterBoundaryConstants";
import { validateStage11EntryItem } from "@/lib/agents/externalExecutionAdapterBoundaryStage11EntryValidation";
import type {
  ExternalExecutionAdapterBoundaryItem,
  ExternalExecutionAdapterBoundaryValidationResult,
} from "@/lib/agents/externalExecutionAdapterBoundaryTypes";

function emptyArrays(): Pick<
  ExternalExecutionAdapterBoundaryValidationResult,
  | "missingItemIds"
  | "duplicateItemIds"
  | "implementedItemIds"
  | "nonDesignOnlyItemIds"
  | "externalExecutionAllowedItemIds"
  | "cursorExecutionAllowedItemIds"
  | "githubWriteAllowedItemIds"
  | "connectorGatewayCallAllowedItemIds"
  | "dbPersistenceAllowedItemIds"
  | "productionRunnerAllowedItemIds"
  | "emptyApprovalItemIds"
  | "emptyForbiddenBoundaryItemIds"
  | "missingStage11CandidateItemIds"
  | "missingRequiredBeforeStage11ItemIds"
> {
  return {
    missingItemIds: [],
    duplicateItemIds: [],
    implementedItemIds: [],
    nonDesignOnlyItemIds: [],
    externalExecutionAllowedItemIds: [],
    cursorExecutionAllowedItemIds: [],
    githubWriteAllowedItemIds: [],
    connectorGatewayCallAllowedItemIds: [],
    dbPersistenceAllowedItemIds: [],
    productionRunnerAllowedItemIds: [],
    emptyApprovalItemIds: [],
    emptyForbiddenBoundaryItemIds: [],
    missingStage11CandidateItemIds: [],
    missingRequiredBeforeStage11ItemIds: [],
  };
}

function emptyInvalidValidation(): ExternalExecutionAdapterBoundaryValidationResult {
  return {
    valid: false,
    missingItemIds: [...STAGE10_A_REQUIRED_ITEM_IDS],
    duplicateItemIds: [],
    implementedItemIds: [],
    nonDesignOnlyItemIds: [],
    externalExecutionAllowedItemIds: [],
    cursorExecutionAllowedItemIds: [],
    githubWriteAllowedItemIds: [],
    connectorGatewayCallAllowedItemIds: [],
    dbPersistenceAllowedItemIds: [],
    productionRunnerAllowedItemIds: [],
    emptyApprovalItemIds: [],
    emptyForbiddenBoundaryItemIds: [],
    missingStage11CandidateItemIds: [STAGE11_ENTRY_ITEM_ID],
    missingRequiredBeforeStage11ItemIds: [],
  };
}

export function validateExternalExecutionAdapterBoundaryItems(
  items: readonly ExternalExecutionAdapterBoundaryItem[],
): ExternalExecutionAdapterBoundaryValidationResult {
  if (items.length === 0) {
    return emptyInvalidValidation();
  }

  const missingItemIds: string[] = [];
  const duplicateItemIds: string[] = [];
  const implementedItemIds: string[] = [];
  const nonDesignOnlyItemIds: string[] = [];
  const externalExecutionAllowedItemIds: string[] = [];
  const cursorExecutionAllowedItemIds: string[] = [];
  const githubWriteAllowedItemIds: string[] = [];
  const connectorGatewayCallAllowedItemIds: string[] = [];
  const dbPersistenceAllowedItemIds: string[] = [];
  const productionRunnerAllowedItemIds: string[] = [];
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
    if (item.designOnly !== true) {
      nonDesignOnlyItemIds.push(item.itemId);
    }
    if (item.externalExecutionAllowedInThisStep !== false) {
      externalExecutionAllowedItemIds.push(item.itemId);
    }
    if (item.cursorExecutionAllowedInThisStep !== false) {
      cursorExecutionAllowedItemIds.push(item.itemId);
    }
    if (item.githubWriteAllowedInThisStep !== false) {
      githubWriteAllowedItemIds.push(item.itemId);
    }
    if (item.connectorGatewayCallAllowedInThisStep !== false) {
      connectorGatewayCallAllowedItemIds.push(item.itemId);
    }
    if (item.dbPersistenceAllowedInThisStep !== false) {
      dbPersistenceAllowedItemIds.push(item.itemId);
    }
    if (item.productionRunnerAllowedInThisStep !== false) {
      productionRunnerAllowedItemIds.push(item.itemId);
    }
    if (item.forbiddenInThisStep.length < 1) {
      emptyForbiddenBoundaryItemIds.push(item.itemId);
    }
    if (item.requiredApprovals.length < 1) {
      emptyApprovalItemIds.push(item.itemId);
    }
  }

  for (const requiredId of STAGE10_A_REQUIRED_ITEM_IDS) {
    if (!seen.has(requiredId)) {
      missingItemIds.push(requiredId);
    }
  }

  const stage11Item = items.find((item) => item.itemId === STAGE11_ENTRY_ITEM_ID);
  const stage11Validation = validateStage11EntryItem(stage11Item);

  const valid =
    missingItemIds.length === 0 &&
    duplicateItemIds.length === 0 &&
    implementedItemIds.length === 0 &&
    nonDesignOnlyItemIds.length === 0 &&
    externalExecutionAllowedItemIds.length === 0 &&
    cursorExecutionAllowedItemIds.length === 0 &&
    githubWriteAllowedItemIds.length === 0 &&
    connectorGatewayCallAllowedItemIds.length === 0 &&
    dbPersistenceAllowedItemIds.length === 0 &&
    productionRunnerAllowedItemIds.length === 0 &&
    emptyForbiddenBoundaryItemIds.length === 0 &&
    emptyApprovalItemIds.length === 0 &&
    stage11Validation.missingStage11CandidateItemIds.length === 0 &&
    stage11Validation.missingRequiredBeforeStage11ItemIds.length === 0;

  if (valid) {
    return { valid: true, ...emptyArrays() };
  }

  return {
    valid: false,
    missingItemIds,
    duplicateItemIds,
    implementedItemIds,
    nonDesignOnlyItemIds,
    externalExecutionAllowedItemIds,
    cursorExecutionAllowedItemIds,
    githubWriteAllowedItemIds,
    connectorGatewayCallAllowedItemIds,
    dbPersistenceAllowedItemIds,
    productionRunnerAllowedItemIds,
    emptyApprovalItemIds,
    emptyForbiddenBoundaryItemIds,
    ...stage11Validation,
  };
}

export function computeStage11EntryReady(
  items: readonly ExternalExecutionAdapterBoundaryItem[],
  validation: ExternalExecutionAdapterBoundaryValidationResult,
): boolean {
  if (!validation.valid) {
    return false;
  }
  const stage11Item = items.find((item) => item.itemId === STAGE11_ENTRY_ITEM_ID);
  return stage11Item?.stage11Candidate === true && stage11Item.requiredBeforeStage11 === true;
}
