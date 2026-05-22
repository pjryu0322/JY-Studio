/**
 * Stage 7-C contract bundle item validation (read-only).
 */

import { STAGE7_C_REQUIRED_BUNDLE_ITEM_IDS } from "@/lib/agents/runtimeContractBundleClosureConstants";
import type {
  RuntimeContractBundleItem,
  RuntimeContractBundleValidationResult,
} from "@/lib/agents/runtimeContractBundleClosureTypes";

const EMPTY_VALIDATION: RuntimeContractBundleValidationResult = {
  valid: true,
  missingBundleItemIds: [],
  duplicateBundleItemIds: [],
  implementedInThisStepItemIds: [],
  emptyApprovalItemIds: [],
  emptyForbiddenBoundaryItemIds: [],
  missingStage8CandidateItemIds: [],
  missingRequiredBeforeStage8ItemIds: [],
};

function emptyInvalidValidation(): RuntimeContractBundleValidationResult {
  return {
    valid: false,
    missingBundleItemIds: [...STAGE7_C_REQUIRED_BUNDLE_ITEM_IDS],
    duplicateBundleItemIds: [],
    implementedInThisStepItemIds: [],
    emptyApprovalItemIds: [],
    emptyForbiddenBoundaryItemIds: [],
    missingStage8CandidateItemIds: ["stage8-minimal-vertical-slice-entry"],
    missingRequiredBeforeStage8ItemIds: [],
  };
}

export function validateRuntimeContractBundleItems(
  items: readonly RuntimeContractBundleItem[],
): RuntimeContractBundleValidationResult {
  if (items.length === 0) {
    return emptyInvalidValidation();
  }

  const missingBundleItemIds: string[] = [];
  const duplicateBundleItemIds: string[] = [];
  const implementedInThisStepItemIds: string[] = [];
  const emptyApprovalItemIds: string[] = [];
  const emptyForbiddenBoundaryItemIds: string[] = [];
  const missingStage8CandidateItemIds: string[] = [];
  const missingRequiredBeforeStage8ItemIds: string[] = [];

  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.bundleItemId)) {
      duplicateBundleItemIds.push(item.bundleItemId);
    } else {
      seen.add(item.bundleItemId);
    }

    if (item.implementedInThisStep !== false) {
      implementedInThisStepItemIds.push(item.bundleItemId);
    }
    if (item.requiredApprovals.length < 1) {
      emptyApprovalItemIds.push(item.bundleItemId);
    }
    if (item.forbiddenInThisStep.length < 1) {
      emptyForbiddenBoundaryItemIds.push(item.bundleItemId);
    }
  }

  for (const requiredId of STAGE7_C_REQUIRED_BUNDLE_ITEM_IDS) {
    if (!seen.has(requiredId)) {
      missingBundleItemIds.push(requiredId);
    }
  }

  const stage8Item = items.find((item) => item.bundleItemId === "stage8-minimal-vertical-slice-entry");
  if (!stage8Item) {
    missingStage8CandidateItemIds.push("stage8-minimal-vertical-slice-entry");
    missingRequiredBeforeStage8ItemIds.push("stage8-minimal-vertical-slice-entry");
  } else {
    if (stage8Item.stage8Candidate !== true) {
      missingStage8CandidateItemIds.push(stage8Item.bundleItemId);
    }
    if (stage8Item.requiredBeforeStage8 !== true) {
      missingRequiredBeforeStage8ItemIds.push(stage8Item.bundleItemId);
    }
  }

  const valid =
    missingBundleItemIds.length === 0 &&
    duplicateBundleItemIds.length === 0 &&
    implementedInThisStepItemIds.length === 0 &&
    emptyApprovalItemIds.length === 0 &&
    emptyForbiddenBoundaryItemIds.length === 0 &&
    missingStage8CandidateItemIds.length === 0 &&
    missingRequiredBeforeStage8ItemIds.length === 0;

  if (valid) {
    return EMPTY_VALIDATION;
  }

  return {
    valid: false,
    missingBundleItemIds,
    duplicateBundleItemIds,
    implementedInThisStepItemIds,
    emptyApprovalItemIds,
    emptyForbiddenBoundaryItemIds,
    missingStage8CandidateItemIds,
    missingRequiredBeforeStage8ItemIds,
  };
}

export function computeStage8EntryReady(
  items: readonly RuntimeContractBundleItem[],
  bundleValidation: RuntimeContractBundleValidationResult,
): boolean {
  if (!bundleValidation.valid) {
    return false;
  }
  const stage8Item = items.find((item) => item.bundleItemId === "stage8-minimal-vertical-slice-entry");
  return stage8Item?.stage8Candidate === true && stage8Item.requiredBeforeStage8 === true;
}
