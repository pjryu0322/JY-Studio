/**
 * Stage 13-A adapter candidate item validation (read-only).
 */

import {
  STAGE13_A_REQUIRED_ITEM_IDS,
  STAGE14_ENTRY_ITEM_ID,
} from "@/lib/agents/actualExternalExecutionAdapterCandidateConstants";
import { validateStage14EntryItem } from "@/lib/agents/actualExternalExecutionAdapterCandidateStage14EntryValidation";
import type {
  ActualExternalExecutionAdapterCandidateItem,
  ActualExternalExecutionAdapterCandidateValidationResult,
} from "@/lib/agents/actualExternalExecutionAdapterCandidateTypes";

function emptyArrays(): Pick<
  ActualExternalExecutionAdapterCandidateValidationResult,
  | "missingItemIds"
  | "duplicateItemIds"
  | "implementedItemIds"
  | "nonCandidateOnlyItemIds"
  | "externalExecutionAllowedItemIds"
  | "cursorAdapterImplementedItemIds"
  | "githubAdapterImplementedItemIds"
  | "connectorAdapterImplementedItemIds"
  | "runnerAdapterImplementedItemIds"
  | "adapterCredentialUsageAllowedItemIds"
  | "networkSideEffectAllowedItemIds"
  | "dbPersistenceAllowedItemIds"
  | "uiImplementationAllowedItemIds"
  | "agentRegistryMutationAllowedItemIds"
  | "emptyApprovalItemIds"
  | "emptyForbiddenBoundaryItemIds"
  | "missingStage14CandidateItemIds"
  | "missingRequiredBeforeStage14ItemIds"
> {
  return {
    missingItemIds: [],
    duplicateItemIds: [],
    implementedItemIds: [],
    nonCandidateOnlyItemIds: [],
    externalExecutionAllowedItemIds: [],
    cursorAdapterImplementedItemIds: [],
    githubAdapterImplementedItemIds: [],
    connectorAdapterImplementedItemIds: [],
    runnerAdapterImplementedItemIds: [],
    adapterCredentialUsageAllowedItemIds: [],
    networkSideEffectAllowedItemIds: [],
    dbPersistenceAllowedItemIds: [],
    uiImplementationAllowedItemIds: [],
    agentRegistryMutationAllowedItemIds: [],
    emptyApprovalItemIds: [],
    emptyForbiddenBoundaryItemIds: [],
    missingStage14CandidateItemIds: [],
    missingRequiredBeforeStage14ItemIds: [],
  };
}

function emptyInvalidValidation(): ActualExternalExecutionAdapterCandidateValidationResult {
  return {
    valid: false,
    missingItemIds: [...STAGE13_A_REQUIRED_ITEM_IDS],
    duplicateItemIds: [],
    implementedItemIds: [],
    nonCandidateOnlyItemIds: [],
    externalExecutionAllowedItemIds: [],
    cursorAdapterImplementedItemIds: [],
    githubAdapterImplementedItemIds: [],
    connectorAdapterImplementedItemIds: [],
    runnerAdapterImplementedItemIds: [],
    adapterCredentialUsageAllowedItemIds: [],
    networkSideEffectAllowedItemIds: [],
    dbPersistenceAllowedItemIds: [],
    uiImplementationAllowedItemIds: [],
    agentRegistryMutationAllowedItemIds: [],
    emptyApprovalItemIds: [],
    emptyForbiddenBoundaryItemIds: [],
    missingStage14CandidateItemIds: [STAGE14_ENTRY_ITEM_ID],
    missingRequiredBeforeStage14ItemIds: [],
  };
}

export function validateActualExternalExecutionAdapterCandidateItems(
  items: readonly ActualExternalExecutionAdapterCandidateItem[],
): ActualExternalExecutionAdapterCandidateValidationResult {
  if (items.length === 0) {
    return emptyInvalidValidation();
  }

  const missingItemIds: string[] = [];
  const duplicateItemIds: string[] = [];
  const implementedItemIds: string[] = [];
  const nonCandidateOnlyItemIds: string[] = [];
  const externalExecutionAllowedItemIds: string[] = [];
  const cursorAdapterImplementedItemIds: string[] = [];
  const githubAdapterImplementedItemIds: string[] = [];
  const connectorAdapterImplementedItemIds: string[] = [];
  const runnerAdapterImplementedItemIds: string[] = [];
  const adapterCredentialUsageAllowedItemIds: string[] = [];
  const networkSideEffectAllowedItemIds: string[] = [];
  const dbPersistenceAllowedItemIds: string[] = [];
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
    if (item.candidateOnly !== true) {
      nonCandidateOnlyItemIds.push(item.itemId);
    }
    if (item.actualExternalExecutionAllowedInThisStep !== false) {
      externalExecutionAllowedItemIds.push(item.itemId);
    }
    if (item.actualCursorAdapterImplementedInThisStep !== false) {
      cursorAdapterImplementedItemIds.push(item.itemId);
    }
    if (item.actualGithubAdapterImplementedInThisStep !== false) {
      githubAdapterImplementedItemIds.push(item.itemId);
    }
    if (item.actualConnectorAdapterImplementedInThisStep !== false) {
      connectorAdapterImplementedItemIds.push(item.itemId);
    }
    if (item.actualRunnerAdapterImplementedInThisStep !== false) {
      runnerAdapterImplementedItemIds.push(item.itemId);
    }
    if (item.actualAdapterCredentialUsageAllowedInThisStep !== false) {
      adapterCredentialUsageAllowedItemIds.push(item.itemId);
    }
    if (item.actualNetworkSideEffectAllowedInThisStep !== false) {
      networkSideEffectAllowedItemIds.push(item.itemId);
    }
    if (item.actualDbPersistenceAllowedInThisStep !== false) {
      dbPersistenceAllowedItemIds.push(item.itemId);
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

  for (const requiredId of STAGE13_A_REQUIRED_ITEM_IDS) {
    if (!seen.has(requiredId)) {
      missingItemIds.push(requiredId);
    }
  }

  const stage14Item = items.find((item) => item.itemId === STAGE14_ENTRY_ITEM_ID);
  const stage14Validation = validateStage14EntryItem(stage14Item);

  const valid =
    missingItemIds.length === 0 &&
    duplicateItemIds.length === 0 &&
    implementedItemIds.length === 0 &&
    nonCandidateOnlyItemIds.length === 0 &&
    externalExecutionAllowedItemIds.length === 0 &&
    cursorAdapterImplementedItemIds.length === 0 &&
    githubAdapterImplementedItemIds.length === 0 &&
    connectorAdapterImplementedItemIds.length === 0 &&
    runnerAdapterImplementedItemIds.length === 0 &&
    adapterCredentialUsageAllowedItemIds.length === 0 &&
    networkSideEffectAllowedItemIds.length === 0 &&
    dbPersistenceAllowedItemIds.length === 0 &&
    uiImplementationAllowedItemIds.length === 0 &&
    agentRegistryMutationAllowedItemIds.length === 0 &&
    emptyForbiddenBoundaryItemIds.length === 0 &&
    emptyApprovalItemIds.length === 0 &&
    stage14Validation.missingStage14CandidateItemIds.length === 0 &&
    stage14Validation.missingRequiredBeforeStage14ItemIds.length === 0;

  if (valid) {
    return { valid: true, ...emptyArrays() };
  }

  return {
    valid: false,
    missingItemIds,
    duplicateItemIds,
    implementedItemIds,
    nonCandidateOnlyItemIds,
    externalExecutionAllowedItemIds,
    cursorAdapterImplementedItemIds,
    githubAdapterImplementedItemIds,
    connectorAdapterImplementedItemIds,
    runnerAdapterImplementedItemIds,
    adapterCredentialUsageAllowedItemIds,
    networkSideEffectAllowedItemIds,
    dbPersistenceAllowedItemIds,
    uiImplementationAllowedItemIds,
    agentRegistryMutationAllowedItemIds,
    emptyApprovalItemIds,
    emptyForbiddenBoundaryItemIds,
    ...stage14Validation,
  };
}

export function computeStage14EntryReady(
  items: readonly ActualExternalExecutionAdapterCandidateItem[],
  validation: ActualExternalExecutionAdapterCandidateValidationResult,
): boolean {
  if (!validation.valid) {
    return false;
  }
  const stage14Item = items.find((item) => item.itemId === STAGE14_ENTRY_ITEM_ID);
  return stage14Item?.stage14Candidate === true && stage14Item.requiredBeforeStage14 === true;
}
