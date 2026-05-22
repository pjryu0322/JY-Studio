/**
 * Stage 9-B closure bundle item validation (read-only).
 */

import {
  STAGE10_ENTRY_ITEM_ID,
  STAGE9_B_REQUIRED_ITEM_IDS,
} from "@/lib/agents/runtimeExecutionMvpClosureConstants";
import { validateStage10EntryItem } from "@/lib/agents/runtimeExecutionMvpClosureStage10EntryValidation";
import type {
  RuntimeExecutionMvpClosureItem,
  RuntimeExecutionMvpClosureValidationResult,
} from "@/lib/agents/runtimeExecutionMvpClosureTypes";

function emptyArrays(): Pick<
  RuntimeExecutionMvpClosureValidationResult,
  | "missingItemIds"
  | "duplicateItemIds"
  | "externalExecutionItemIds"
  | "dbPersistenceItemIds"
  | "productionRunnerItemIds"
  | "emptyForbiddenBoundaryItemIds"
  | "emptyApprovalItemIds"
  | "missingStage10CandidateItemIds"
  | "missingRequiredBeforeStage10ItemIds"
> {
  return {
    missingItemIds: [],
    duplicateItemIds: [],
    externalExecutionItemIds: [],
    dbPersistenceItemIds: [],
    productionRunnerItemIds: [],
    emptyForbiddenBoundaryItemIds: [],
    emptyApprovalItemIds: [],
    missingStage10CandidateItemIds: [],
    missingRequiredBeforeStage10ItemIds: [],
  };
}

function emptyInvalidValidation(): RuntimeExecutionMvpClosureValidationResult {
  return {
    valid: false,
    missingItemIds: [...STAGE9_B_REQUIRED_ITEM_IDS],
    duplicateItemIds: [],
    externalExecutionItemIds: [],
    dbPersistenceItemIds: [],
    productionRunnerItemIds: [],
    emptyForbiddenBoundaryItemIds: [],
    emptyApprovalItemIds: [],
    missingStage10CandidateItemIds: [STAGE10_ENTRY_ITEM_ID],
    missingRequiredBeforeStage10ItemIds: [],
  };
}

export function validateRuntimeExecutionMvpClosureItems(
  items: readonly RuntimeExecutionMvpClosureItem[],
): RuntimeExecutionMvpClosureValidationResult {
  if (items.length === 0) {
    return emptyInvalidValidation();
  }

  const missingItemIds: string[] = [];
  const duplicateItemIds: string[] = [];
  const externalExecutionItemIds: string[] = [];
  const dbPersistenceItemIds: string[] = [];
  const productionRunnerItemIds: string[] = [];
  const emptyForbiddenBoundaryItemIds: string[] = [];
  const emptyApprovalItemIds: string[] = [];

  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.itemId)) {
      duplicateItemIds.push(item.itemId);
    } else {
      seen.add(item.itemId);
    }

    if (item.actualExternalExecution !== false) {
      externalExecutionItemIds.push(item.itemId);
    }
    if (item.dbPersistence !== false) {
      dbPersistenceItemIds.push(item.itemId);
    }
    if (item.productionRunner !== false) {
      productionRunnerItemIds.push(item.itemId);
    }
    if (item.forbiddenInThisStep.length < 1) {
      emptyForbiddenBoundaryItemIds.push(item.itemId);
    }
    if (item.requiredApprovals.length < 1) {
      emptyApprovalItemIds.push(item.itemId);
    }
  }

  for (const requiredId of STAGE9_B_REQUIRED_ITEM_IDS) {
    if (!seen.has(requiredId)) {
      missingItemIds.push(requiredId);
    }
  }

  const stage10Item = items.find((item) => item.itemId === STAGE10_ENTRY_ITEM_ID);
  const stage10Validation = validateStage10EntryItem(stage10Item);

  const valid =
    missingItemIds.length === 0 &&
    duplicateItemIds.length === 0 &&
    externalExecutionItemIds.length === 0 &&
    dbPersistenceItemIds.length === 0 &&
    productionRunnerItemIds.length === 0 &&
    emptyForbiddenBoundaryItemIds.length === 0 &&
    emptyApprovalItemIds.length === 0 &&
    stage10Validation.missingStage10CandidateItemIds.length === 0 &&
    stage10Validation.missingRequiredBeforeStage10ItemIds.length === 0;

  if (valid) {
    return { valid: true, ...emptyArrays() };
  }

  return {
    valid: false,
    missingItemIds,
    duplicateItemIds,
    externalExecutionItemIds,
    dbPersistenceItemIds,
    productionRunnerItemIds,
    emptyForbiddenBoundaryItemIds,
    emptyApprovalItemIds,
    ...stage10Validation,
  };
}

export function computeStage10EntryReady(
  items: readonly RuntimeExecutionMvpClosureItem[],
  validation: RuntimeExecutionMvpClosureValidationResult,
): boolean {
  if (!validation.valid) {
    return false;
  }
  const stage10Item = items.find((item) => item.itemId === STAGE10_ENTRY_ITEM_ID);
  return stage10Item?.stage10Candidate === true && stage10Item.requiredBeforeStage10 === true;
}
