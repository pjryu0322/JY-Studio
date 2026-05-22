/**
 * Stage 8-B control bundle item validation (read-only).
 */

import {
  STAGE8_B_REQUIRED_CONTROL_ITEM_IDS,
  STAGE9_ENTRY_REQUIRED_APPROVALS,
  STAGE9_ENTRY_REQUIRED_FORBIDDEN_MARKERS,
} from "@/lib/agents/runtimeControlBundleConstants";
import type {
  RuntimeControlBundleItem,
  RuntimeControlBundleValidationResult,
} from "@/lib/agents/runtimeControlBundleTypes";

const STAGE9_ENTRY_ITEM_ID = "stage9-runtime-execution-orchestration-entry";

function emptyValidationArrays(): Pick<
  RuntimeControlBundleValidationResult,
  | "missingItemIds"
  | "duplicateItemIds"
  | "implementedItemIds"
  | "nonDesignOnlyItemIds"
  | "emptyForbiddenBoundaryItemIds"
  | "emptyApprovalItemIds"
  | "missingStage9CandidateItemIds"
  | "missingRequiredBeforeStage9ItemIds"
> {
  return {
    missingItemIds: [],
    duplicateItemIds: [],
    implementedItemIds: [],
    nonDesignOnlyItemIds: [],
    emptyForbiddenBoundaryItemIds: [],
    emptyApprovalItemIds: [],
    missingStage9CandidateItemIds: [],
    missingRequiredBeforeStage9ItemIds: [],
  };
}

const EMPTY_VALIDATION: RuntimeControlBundleValidationResult = {
  valid: true,
  ...emptyValidationArrays(),
};

function emptyInvalidValidation(): RuntimeControlBundleValidationResult {
  return {
    valid: false,
    missingItemIds: [...STAGE8_B_REQUIRED_CONTROL_ITEM_IDS],
    duplicateItemIds: [],
    implementedItemIds: [],
    nonDesignOnlyItemIds: [],
    emptyForbiddenBoundaryItemIds: [],
    emptyApprovalItemIds: [],
    missingStage9CandidateItemIds: [STAGE9_ENTRY_ITEM_ID],
    missingRequiredBeforeStage9ItemIds: [],
  };
}

function hasStage9EntryScope(item: RuntimeControlBundleItem): boolean {
  const combined = `${item.title} ${item.purpose}`.toLowerCase();
  const hasTextMarker = combined.includes("stage 9") || combined.includes("orchestration");
  const forbiddenHits = item.forbiddenInThisStep.filter((forbidden) =>
    (STAGE9_ENTRY_REQUIRED_FORBIDDEN_MARKERS as readonly string[]).includes(forbidden),
  ).length;
  return hasTextMarker && forbiddenHits >= 2;
}

function hasStage9SeparateApprovals(item: RuntimeControlBundleItem): boolean {
  return STAGE9_ENTRY_REQUIRED_APPROVALS.every((approval) => item.requiredApprovals.includes(approval));
}

function validateStage9EntryItem(stage9Item: RuntimeControlBundleItem | undefined): {
  readonly missingStage9CandidateItemIds: string[];
  readonly missingRequiredBeforeStage9ItemIds: string[];
} {
  const missingStage9CandidateItemIds: string[] = [];
  const missingRequiredBeforeStage9ItemIds: string[] = [];

  if (!stage9Item) {
    missingStage9CandidateItemIds.push(STAGE9_ENTRY_ITEM_ID);
    missingRequiredBeforeStage9ItemIds.push(STAGE9_ENTRY_ITEM_ID);
    return { missingStage9CandidateItemIds, missingRequiredBeforeStage9ItemIds };
  }

  if (stage9Item.stage9Candidate !== true) {
    missingStage9CandidateItemIds.push(stage9Item.itemId);
  }
  if (stage9Item.requiredBeforeStage9 !== true) {
    missingRequiredBeforeStage9ItemIds.push(stage9Item.itemId);
  }
  if (!hasStage9EntryScope(stage9Item)) {
    missingStage9CandidateItemIds.push(stage9Item.itemId);
  }
  if (!hasStage9SeparateApprovals(stage9Item)) {
    missingStage9CandidateItemIds.push(stage9Item.itemId);
  }

  return { missingStage9CandidateItemIds, missingRequiredBeforeStage9ItemIds };
}

export function validateRuntimeControlBundleItems(
  items: readonly RuntimeControlBundleItem[],
): RuntimeControlBundleValidationResult {
  if (items.length === 0) {
    return emptyInvalidValidation();
  }

  const missingItemIds: string[] = [];
  const duplicateItemIds: string[] = [];
  const implementedItemIds: string[] = [];
  const nonDesignOnlyItemIds: string[] = [];
  const emptyForbiddenBoundaryItemIds: string[] = [];
  const emptyApprovalItemIds: string[] = [];

  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.itemId)) {
      duplicateItemIds.push(item.itemId);
    } else {
      seen.add(item.itemId);
    }

    if (item.designOnly !== true) {
      nonDesignOnlyItemIds.push(item.itemId);
    }
    if (item.implementedInThisStep !== false) {
      implementedItemIds.push(item.itemId);
    }
    if (item.forbiddenInThisStep.length < 1) {
      emptyForbiddenBoundaryItemIds.push(item.itemId);
    }
    if (item.requiredApprovals.length < 1) {
      emptyApprovalItemIds.push(item.itemId);
    }
  }

  for (const requiredId of STAGE8_B_REQUIRED_CONTROL_ITEM_IDS) {
    if (!seen.has(requiredId)) {
      missingItemIds.push(requiredId);
    }
  }

  const stage9Item = items.find((item) => item.itemId === STAGE9_ENTRY_ITEM_ID);
  const stage9Validation = validateStage9EntryItem(stage9Item);

  const valid =
    missingItemIds.length === 0 &&
    duplicateItemIds.length === 0 &&
    implementedItemIds.length === 0 &&
    nonDesignOnlyItemIds.length === 0 &&
    emptyForbiddenBoundaryItemIds.length === 0 &&
    emptyApprovalItemIds.length === 0 &&
    stage9Validation.missingStage9CandidateItemIds.length === 0 &&
    stage9Validation.missingRequiredBeforeStage9ItemIds.length === 0;

  if (valid) {
    return EMPTY_VALIDATION;
  }

  return {
    valid: false,
    missingItemIds,
    duplicateItemIds,
    implementedItemIds,
    nonDesignOnlyItemIds,
    emptyForbiddenBoundaryItemIds,
    emptyApprovalItemIds,
    ...stage9Validation,
  };
}

export function computeStage9EntryReady(
  items: readonly RuntimeControlBundleItem[],
  validation: RuntimeControlBundleValidationResult,
): boolean {
  if (!validation.valid) {
    return false;
  }
  const stage9Item = items.find((item) => item.itemId === STAGE9_ENTRY_ITEM_ID);
  return stage9Item?.stage9Candidate === true && stage9Item.requiredBeforeStage9 === true;
}
