/**
 * Stage 13-A Stage 14 entry item validation (read-only).
 */

import {
  STAGE14_ENTRY_ITEM_ID,
  STAGE14_ENTRY_REQUIRED_APPROVALS,
  STAGE14_ENTRY_REQUIRED_FORBIDDEN_MARKERS,
} from "@/lib/agents/actualExternalExecutionAdapterCandidateConstants";
import type { ActualExternalExecutionAdapterCandidateItem } from "@/lib/agents/actualExternalExecutionAdapterCandidateTypes";

function hasStage14EntryScope(item: ActualExternalExecutionAdapterCandidateItem): boolean {
  return item.forbiddenInThisStep.some((marker) => STAGE14_ENTRY_REQUIRED_FORBIDDEN_MARKERS.includes(marker));
}

function hasStage14EntryApprovals(item: ActualExternalExecutionAdapterCandidateItem): boolean {
  return STAGE14_ENTRY_REQUIRED_APPROVALS.every((approval) => item.requiredApprovals.includes(approval));
}

export function validateStage14EntryItem(item: ActualExternalExecutionAdapterCandidateItem | undefined): {
  readonly missingStage14CandidateItemIds: readonly string[];
  readonly missingRequiredBeforeStage14ItemIds: readonly string[];
} {
  if (!item || item.itemId !== STAGE14_ENTRY_ITEM_ID) {
    return {
      missingStage14CandidateItemIds: [STAGE14_ENTRY_ITEM_ID],
      missingRequiredBeforeStage14ItemIds: [],
    };
  }

  const missingStage14CandidateItemIds: string[] = [];
  const missingRequiredBeforeStage14ItemIds: string[] = [];

  if (item.stage14Candidate !== true) {
    missingStage14CandidateItemIds.push(item.itemId);
  }
  if (item.requiredBeforeStage14 !== true) {
    missingRequiredBeforeStage14ItemIds.push(item.itemId);
  }
  if (!hasStage14EntryScope(item) || !hasStage14EntryApprovals(item)) {
    missingStage14CandidateItemIds.push(item.itemId);
  }

  return { missingStage14CandidateItemIds, missingRequiredBeforeStage14ItemIds };
}
