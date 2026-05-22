/**
 * Stage 9-B runtime MVP closure checklists (read-only).
 */

import type { RuntimeExecutionMvpClosureChecklistItem } from "@/lib/agents/runtimeExecutionMvpClosureTypes";

export function buildRuntimeExecutionMvpClosureChecklists(input: {
  readonly sourceStage9Decision: string;
  readonly sourceStage9AClosureReady: boolean;
  readonly validationValid: boolean;
  readonly stage10EntryReady: boolean;
  readonly confirmationsSatisfied: boolean;
}): {
  readonly checklist: readonly RuntimeExecutionMvpClosureChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeExecutionMvpClosureChecklistItem[];
} {
  const checklist: RuntimeExecutionMvpClosureChecklistItem[] = [
    {
      item: "stage9_api_mvp_ready",
      satisfied: input.sourceStage9Decision === "stage9_runtime_execution_api_mvp_ready",
      reason: "sourceStage9Decision",
    },
    {
      item: "stage9_a_closure_ready",
      satisfied: input.sourceStage9AClosureReady,
      reason: "sourceStage9AClosureReady",
    },
    {
      item: "closure_items_valid",
      satisfied: input.validationValid,
      reason: "validationValid",
    },
    {
      item: "stage10_entry_ready",
      satisfied: input.stage10EntryReady,
      reason: "stage10EntryReady",
    },
    {
      item: "confirmations_satisfied",
      satisfied: input.confirmationsSatisfied,
      reason: "confirmationsSatisfied",
    },
  ];

  const boundaryChecklist: RuntimeExecutionMvpClosureChecklistItem[] = [
    {
      item: "stage10ImplementationAllowedInThisStep=false",
      satisfied: true,
      reason: "Stage 9-B read-only closure",
    },
    {
      item: "actualExternalExecution=false",
      satisfied: true,
      reason: "Stage 9-B read-only closure",
    },
    {
      item: "dbPersistence=false",
      satisfied: true,
      reason: "Stage 9-B read-only closure",
    },
  ];

  return { checklist, boundaryChecklist };
}
