/**
 * Stage 11-A Stage 12 entry item validation (read-only).
 */

import {
  STAGE12_ENTRY_ITEM_ID,
  STAGE12_ENTRY_REQUIRED_APPROVALS,
  STAGE12_ENTRY_REQUIRED_FORBIDDEN_MARKERS,
} from "@/lib/agents/externalExecutionDryRunPackageConstants";
import type { ExternalExecutionDryRunPackageItem } from "@/lib/agents/externalExecutionDryRunPackageTypes";

function hasStage12EntryScope(item: ExternalExecutionDryRunPackageItem): boolean {
  return item.forbiddenInThisStep.some((marker) =>
    (STAGE12_ENTRY_REQUIRED_FORBIDDEN_MARKERS as readonly string[]).includes(marker)
  );
}

function hasStage12EntryApprovals(item: ExternalExecutionDryRunPackageItem): boolean {
  return STAGE12_ENTRY_REQUIRED_APPROVALS.every((approval) => item.requiredApprovals.includes(approval));
}

export function validateStage12EntryItem(item: ExternalExecutionDryRunPackageItem | undefined): {
  readonly missingStage12CandidateItemIds: readonly string[];
  readonly missingRequiredBeforeStage12ItemIds: readonly string[];
} {
  if (!item || item.itemId !== STAGE12_ENTRY_ITEM_ID) {
    return {
      missingStage12CandidateItemIds: [STAGE12_ENTRY_ITEM_ID],
      missingRequiredBeforeStage12ItemIds: [],
    };
  }

  const missingStage12CandidateItemIds: string[] = [];
  const missingRequiredBeforeStage12ItemIds: string[] = [];

  if (item.stage12Candidate !== true) {
    missingStage12CandidateItemIds.push(item.itemId);
  }
  if (item.requiredBeforeStage12 !== true) {
    missingRequiredBeforeStage12ItemIds.push(item.itemId);
  }
  if (!hasStage12EntryScope(item) || !hasStage12EntryApprovals(item)) {
    missingStage12CandidateItemIds.push(item.itemId);
  }

  return { missingStage12CandidateItemIds, missingRequiredBeforeStage12ItemIds };
}
