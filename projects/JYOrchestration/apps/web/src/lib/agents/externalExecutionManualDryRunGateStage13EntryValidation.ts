/**
 * Stage 12-A Stage 13 entry item validation (read-only).
 */

import {
  STAGE13_ENTRY_ITEM_ID,
  STAGE13_ENTRY_REQUIRED_APPROVALS,
  STAGE13_ENTRY_REQUIRED_FORBIDDEN_MARKERS,
} from "@/lib/agents/externalExecutionManualDryRunGateConstants";
import type { ExternalExecutionManualDryRunGateItem } from "@/lib/agents/externalExecutionManualDryRunGateTypes";

function hasStage13EntryScope(item: ExternalExecutionManualDryRunGateItem): boolean {
  return item.forbiddenInThisStep.some((marker) => STAGE13_ENTRY_REQUIRED_FORBIDDEN_MARKERS.includes(marker));
}

function hasStage13EntryApprovals(item: ExternalExecutionManualDryRunGateItem): boolean {
  return STAGE13_ENTRY_REQUIRED_APPROVALS.every((approval) => item.requiredApprovals.includes(approval));
}

export function validateStage13EntryItem(item: ExternalExecutionManualDryRunGateItem | undefined): {
  readonly missingStage13CandidateItemIds: readonly string[];
  readonly missingRequiredBeforeStage13ItemIds: readonly string[];
} {
  if (!item || item.itemId !== STAGE13_ENTRY_ITEM_ID) {
    return {
      missingStage13CandidateItemIds: [STAGE13_ENTRY_ITEM_ID],
      missingRequiredBeforeStage13ItemIds: [],
    };
  }

  const missingStage13CandidateItemIds: string[] = [];
  const missingRequiredBeforeStage13ItemIds: string[] = [];

  if (item.stage13Candidate !== true) {
    missingStage13CandidateItemIds.push(item.itemId);
  }
  if (item.requiredBeforeStage13 !== true) {
    missingRequiredBeforeStage13ItemIds.push(item.itemId);
  }
  if (!hasStage13EntryScope(item) || !hasStage13EntryApprovals(item)) {
    missingStage13CandidateItemIds.push(item.itemId);
  }

  return { missingStage13CandidateItemIds, missingRequiredBeforeStage13ItemIds };
}
