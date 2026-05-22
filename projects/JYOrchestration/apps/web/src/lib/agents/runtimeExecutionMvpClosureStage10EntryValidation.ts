/**
 * Stage 9-B Stage 10 entry item validation (read-only).
 */

import {
  STAGE10_ENTRY_ITEM_ID,
  STAGE10_ENTRY_REQUIRED_APPROVALS,
  STAGE10_ENTRY_REQUIRED_FORBIDDEN_MARKERS,
} from "@/lib/agents/runtimeExecutionMvpClosureConstants";
import type { RuntimeExecutionMvpClosureItem } from "@/lib/agents/runtimeExecutionMvpClosureTypes";

function hasStage10EntryScope(item: RuntimeExecutionMvpClosureItem): boolean {
  const combined = `${item.title} ${item.purpose}`.toLowerCase();
  const hasTextMarker = combined.includes("stage 10") || combined.includes("external execution");
  const forbiddenHits = item.forbiddenInThisStep.filter((forbidden) =>
    (STAGE10_ENTRY_REQUIRED_FORBIDDEN_MARKERS as readonly string[]).includes(forbidden),
  ).length;
  return hasTextMarker && forbiddenHits >= 2;
}

function hasStage10SeparateApprovals(item: RuntimeExecutionMvpClosureItem): boolean {
  return STAGE10_ENTRY_REQUIRED_APPROVALS.every((approval) => item.requiredApprovals.includes(approval));
}

export function validateStage10EntryItem(stage10Item: RuntimeExecutionMvpClosureItem | undefined): {
  readonly missingStage10CandidateItemIds: string[];
  readonly missingRequiredBeforeStage10ItemIds: string[];
} {
  const missingStage10CandidateItemIds: string[] = [];
  const missingRequiredBeforeStage10ItemIds: string[] = [];

  if (!stage10Item) {
    missingStage10CandidateItemIds.push(STAGE10_ENTRY_ITEM_ID);
    missingRequiredBeforeStage10ItemIds.push(STAGE10_ENTRY_ITEM_ID);
    return { missingStage10CandidateItemIds, missingRequiredBeforeStage10ItemIds };
  }

  if (stage10Item.stage10Candidate !== true) {
    missingStage10CandidateItemIds.push(stage10Item.itemId);
  }
  if (stage10Item.requiredBeforeStage10 !== true) {
    missingRequiredBeforeStage10ItemIds.push(stage10Item.itemId);
  }
  if (!hasStage10EntryScope(stage10Item)) {
    missingStage10CandidateItemIds.push(stage10Item.itemId);
  }
  if (!hasStage10SeparateApprovals(stage10Item)) {
    missingStage10CandidateItemIds.push(stage10Item.itemId);
  }

  return { missingStage10CandidateItemIds, missingRequiredBeforeStage10ItemIds };
}
