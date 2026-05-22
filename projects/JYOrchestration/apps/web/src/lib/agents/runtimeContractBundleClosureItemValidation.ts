/**
 * Stage 7-C contract bundle item validation (read-only).
 */

import {
  STAGE7_C_REQUIRED_BUNDLE_ITEM_IDS,
  STAGE8_ENTRY_REQUIRED_APPROVALS,
  STAGE8_ENTRY_REQUIRED_FORBIDDEN_MARKERS,
} from "@/lib/agents/runtimeContractBundleClosureConstants";
import type {
  RuntimeContractBundleItem,
  RuntimeContractBundleValidationResult,
} from "@/lib/agents/runtimeContractBundleClosureTypes";

const STAGE8_ENTRY_ITEM_ID = "stage8-minimal-vertical-slice-entry";
const STAGE8_SCOPE_TEXT_MARKERS = ["stage 8", "vertical slice", "minimal"] as const;

function emptyValidationArrays(): Pick<
  RuntimeContractBundleValidationResult,
  | "missingBundleItemIds"
  | "duplicateBundleItemIds"
  | "implementedInThisStepItemIds"
  | "emptyApprovalItemIds"
  | "emptyForbiddenBoundaryItemIds"
  | "missingStage8CandidateItemIds"
  | "missingRequiredBeforeStage8ItemIds"
  | "nonDesignOnlyItemIds"
  | "missingStage8ScopeItemIds"
  | "missingSeparateApprovalItemIds"
> {
  return {
    missingBundleItemIds: [],
    duplicateBundleItemIds: [],
    implementedInThisStepItemIds: [],
    emptyApprovalItemIds: [],
    emptyForbiddenBoundaryItemIds: [],
    missingStage8CandidateItemIds: [],
    missingRequiredBeforeStage8ItemIds: [],
    nonDesignOnlyItemIds: [],
    missingStage8ScopeItemIds: [],
    missingSeparateApprovalItemIds: [],
  };
}

const EMPTY_VALIDATION: RuntimeContractBundleValidationResult = {
  valid: true,
  ...emptyValidationArrays(),
};

function emptyInvalidValidation(): RuntimeContractBundleValidationResult {
  return {
    valid: false,
    missingBundleItemIds: [...STAGE7_C_REQUIRED_BUNDLE_ITEM_IDS],
    duplicateBundleItemIds: [],
    implementedInThisStepItemIds: [],
    emptyApprovalItemIds: [],
    emptyForbiddenBoundaryItemIds: [],
    missingStage8CandidateItemIds: [STAGE8_ENTRY_ITEM_ID],
    missingRequiredBeforeStage8ItemIds: [],
    nonDesignOnlyItemIds: [],
    missingStage8ScopeItemIds: [STAGE8_ENTRY_ITEM_ID],
    missingSeparateApprovalItemIds: [STAGE8_ENTRY_ITEM_ID],
  };
}

function hasStage8ScopeIdentifiable(item: RuntimeContractBundleItem): boolean {
  const combined = `${item.title} ${item.purpose}`.toLowerCase();
  const hasTextMarker = STAGE8_SCOPE_TEXT_MARKERS.some((marker) => combined.includes(marker));
  const forbiddenHits = item.forbiddenInThisStep.filter((forbidden) =>
    (STAGE8_ENTRY_REQUIRED_FORBIDDEN_MARKERS as readonly string[]).includes(forbidden),
  ).length;
  return hasTextMarker && forbiddenHits >= 2;
}

function hasStage8SeparateApprovals(item: RuntimeContractBundleItem): boolean {
  return STAGE8_ENTRY_REQUIRED_APPROVALS.every((approval) => item.requiredApprovals.includes(approval));
}

function validateStage8EntryItem(stage8Item: RuntimeContractBundleItem | undefined): {
  readonly missingStage8CandidateItemIds: string[];
  readonly missingRequiredBeforeStage8ItemIds: string[];
  readonly missingStage8ScopeItemIds: string[];
  readonly missingSeparateApprovalItemIds: string[];
} {
  const missingStage8CandidateItemIds: string[] = [];
  const missingRequiredBeforeStage8ItemIds: string[] = [];
  const missingStage8ScopeItemIds: string[] = [];
  const missingSeparateApprovalItemIds: string[] = [];

  if (!stage8Item) {
    missingStage8CandidateItemIds.push(STAGE8_ENTRY_ITEM_ID);
    missingRequiredBeforeStage8ItemIds.push(STAGE8_ENTRY_ITEM_ID);
    missingStage8ScopeItemIds.push(STAGE8_ENTRY_ITEM_ID);
    missingSeparateApprovalItemIds.push(STAGE8_ENTRY_ITEM_ID);
    return {
      missingStage8CandidateItemIds,
      missingRequiredBeforeStage8ItemIds,
      missingStage8ScopeItemIds,
      missingSeparateApprovalItemIds,
    };
  }

  if (stage8Item.stage8Candidate !== true) {
    missingStage8CandidateItemIds.push(stage8Item.bundleItemId);
  }
  if (stage8Item.requiredBeforeStage8 !== true) {
    missingRequiredBeforeStage8ItemIds.push(stage8Item.bundleItemId);
  }
  if (!hasStage8ScopeIdentifiable(stage8Item)) {
    missingStage8ScopeItemIds.push(stage8Item.bundleItemId);
  }
  if (!hasStage8SeparateApprovals(stage8Item)) {
    missingSeparateApprovalItemIds.push(stage8Item.bundleItemId);
  }

  return {
    missingStage8CandidateItemIds,
    missingRequiredBeforeStage8ItemIds,
    missingStage8ScopeItemIds,
    missingSeparateApprovalItemIds,
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
  const nonDesignOnlyItemIds: string[] = [];

  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.bundleItemId)) {
      duplicateBundleItemIds.push(item.bundleItemId);
    } else {
      seen.add(item.bundleItemId);
    }

    if (item.designOnly !== true) {
      nonDesignOnlyItemIds.push(item.bundleItemId);
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

  const stage8Item = items.find((item) => item.bundleItemId === STAGE8_ENTRY_ITEM_ID);
  const stage8Validation = validateStage8EntryItem(stage8Item);

  const valid =
    missingBundleItemIds.length === 0 &&
    duplicateBundleItemIds.length === 0 &&
    implementedInThisStepItemIds.length === 0 &&
    emptyApprovalItemIds.length === 0 &&
    emptyForbiddenBoundaryItemIds.length === 0 &&
    nonDesignOnlyItemIds.length === 0 &&
    stage8Validation.missingStage8CandidateItemIds.length === 0 &&
    stage8Validation.missingRequiredBeforeStage8ItemIds.length === 0 &&
    stage8Validation.missingStage8ScopeItemIds.length === 0 &&
    stage8Validation.missingSeparateApprovalItemIds.length === 0;

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
    nonDesignOnlyItemIds,
    ...stage8Validation,
  };
}

export function computeStage8EntryReady(
  items: readonly RuntimeContractBundleItem[],
  bundleValidation: RuntimeContractBundleValidationResult,
): boolean {
  if (!bundleValidation.valid) {
    return false;
  }
  const stage8Item = items.find((item) => item.bundleItemId === STAGE8_ENTRY_ITEM_ID);
  return stage8Item?.stage8Candidate === true && stage8Item.requiredBeforeStage8 === true;
}
