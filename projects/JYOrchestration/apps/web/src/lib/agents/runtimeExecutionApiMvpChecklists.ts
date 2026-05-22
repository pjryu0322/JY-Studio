/**
 * Stage 9-A runtime execution API MVP checklists (read-only).
 */

import type { RuntimeExecutionApiMvpChecklistItem } from "@/lib/agents/runtimeExecutionApiMvpTypes";

export function buildRuntimeExecutionApiMvpChecklists(input: {
  readonly sourceStage8Decision: string;
  readonly sourceStage9EntryReady: boolean;
  readonly confirmationsSatisfied: boolean;
}): {
  readonly checklist: readonly RuntimeExecutionApiMvpChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeExecutionApiMvpChecklistItem[];
} {
  const checklist: RuntimeExecutionApiMvpChecklistItem[] = [
    {
      item: "stage8_control_bundle_ready",
      satisfied: input.sourceStage8Decision === "stage8_runtime_control_bundle_ready",
      reason: "sourceStage8Decision",
    },
    {
      item: "stage9_entry_ready",
      satisfied: input.sourceStage9EntryReady,
      reason: "sourceStage9EntryReady",
    },
    {
      item: "confirmations_satisfied",
      satisfied: input.confirmationsSatisfied,
      reason: "confirmationsSatisfied",
    },
  ];

  const boundaryChecklist: RuntimeExecutionApiMvpChecklistItem[] = [
    {
      item: "actualExternalExecutionAllowedInThisStep=false",
      satisfied: true,
      reason: "Stage 9-A MVP boundary",
    },
    {
      item: "actualDbWriteAllowedInThisStep=false",
      satisfied: true,
      reason: "Stage 9-A MVP boundary",
    },
    {
      item: "actualUiImplementationAllowedInThisStep=false",
      satisfied: true,
      reason: "Stage 9-A MVP boundary",
    },
  ];

  return { checklist, boundaryChecklist };
}
