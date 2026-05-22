/**
 * Stage 7-C contract bundle item builders and validation (read-only).
 */

import type { RuntimeApiContractDesignReport } from "@/lib/agents/runtimeApiContractDesignTypes";
import {
  STAGE7_C_BUNDLE_ITEM_SPECS,
  STAGE7_C_REQUIRED_BUNDLE_ITEM_IDS,
} from "@/lib/agents/runtimeContractBundleClosureConstants";
import type {
  RuntimeContractBundleItem,
  RuntimeContractBundleValidationResult,
} from "@/lib/agents/runtimeContractBundleClosureTypes";

function sourceReadyForBundleItems(source: RuntimeApiContractDesignReport): boolean {
  return (
    source.decision === "ready_for_execution_runner_contract_design" &&
    source.apiContractDesignOnly === true &&
    source.endpointContractCount >= 6 &&
    source.endpointDesignOnlyCount === source.endpointContractCount &&
    source.implementedEndpointCount === 0 &&
    source.actualApiEndpointImplementedInThisStep === false &&
    source.actualRuntimeExecutionAllowedInThisStep === false &&
    source.actualExecutionRunnerAllowedInThisStep === false &&
    source.actualDryRunRunnerAllowedInThisStep === false &&
    source.actualExecutionWireAllowedInThisStep === false &&
    source.actualPersistenceAllowedInThisStep === false &&
    source.actualSchemaMigrationAllowedInThisStep === false &&
    source.actualCursorGithubWireAllowedInThisStep === false &&
    source.actualConnectorRoutingChangeAllowedInThisStep === false
  );
}

export function buildRuntimeContractBundleItems(
  source: RuntimeApiContractDesignReport,
): readonly RuntimeContractBundleItem[] {
  if (!sourceReadyForBundleItems(source)) {
    return [];
  }

  return STAGE7_C_REQUIRED_BUNDLE_ITEM_IDS.map((bundleItemId) => {
    const spec = STAGE7_C_BUNDLE_ITEM_SPECS[bundleItemId];
    return {
      bundleItemId,
      area: spec.area,
      title: spec.title,
      purpose: spec.purpose,
      source: spec.source,
      designOnly: true as const,
      implementedInThisStep: false as const,
      stage8Candidate: spec.stage8Candidate,
      requiredBeforeStage8: spec.requiredBeforeStage8,
      forbiddenInThisStep: [...spec.forbiddenInThisStep],
      requiredApprovals: [...spec.requiredApprovals],
    };
  });
}

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

export function validateRuntimeContractBundleItems(
  items: readonly RuntimeContractBundleItem[],
): RuntimeContractBundleValidationResult {
  if (items.length === 0) {
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
