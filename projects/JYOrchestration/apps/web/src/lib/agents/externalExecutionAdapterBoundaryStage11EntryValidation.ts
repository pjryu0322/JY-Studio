/**
 * Stage 10-A Stage 11 entry item validation (read-only).
 */

import {
  STAGE11_ENTRY_ITEM_ID,
  STAGE11_ENTRY_REQUIRED_APPROVALS,
  STAGE11_ENTRY_REQUIRED_FORBIDDEN_MARKERS,
} from "@/lib/agents/externalExecutionAdapterBoundaryConstants";
import type { ExternalExecutionAdapterBoundaryItem } from "@/lib/agents/externalExecutionAdapterBoundaryTypes";

function hasStage11EntryScope(item: ExternalExecutionAdapterBoundaryItem): boolean {
  return item.forbiddenInThisStep.some((marker) =>
    (STAGE11_ENTRY_REQUIRED_FORBIDDEN_MARKERS as readonly string[]).includes(marker)
  );
}

function hasStage11EntryApprovals(item: ExternalExecutionAdapterBoundaryItem): boolean {
  return STAGE11_ENTRY_REQUIRED_APPROVALS.every((approval) => item.requiredApprovals.includes(approval));
}

export function validateStage11EntryItem(item: ExternalExecutionAdapterBoundaryItem | undefined): {
  readonly missingStage11CandidateItemIds: readonly string[];
  readonly missingRequiredBeforeStage11ItemIds: readonly string[];
} {
  if (!item || item.itemId !== STAGE11_ENTRY_ITEM_ID) {
    return {
      missingStage11CandidateItemIds: [STAGE11_ENTRY_ITEM_ID],
      missingRequiredBeforeStage11ItemIds: [],
    };
  }

  const missingStage11CandidateItemIds: string[] = [];
  const missingRequiredBeforeStage11ItemIds: string[] = [];

  if (item.stage11Candidate !== true) {
    missingStage11CandidateItemIds.push(item.itemId);
  }
  if (item.requiredBeforeStage11 !== true) {
    missingRequiredBeforeStage11ItemIds.push(item.itemId);
  }
  if (!hasStage11EntryScope(item) || !hasStage11EntryApprovals(item)) {
    missingStage11CandidateItemIds.push(item.itemId);
  }

  return { missingStage11CandidateItemIds, missingRequiredBeforeStage11ItemIds };
}
