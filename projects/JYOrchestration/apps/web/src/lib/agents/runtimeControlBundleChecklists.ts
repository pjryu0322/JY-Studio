/**
 * Stage 8-B runtime control bundle checklists (read-only).
 */

import type { RuntimeControlBundleChecklistItem } from "@/lib/agents/runtimeControlBundleTypes";

export function buildRuntimeControlBundleChecklists(input: {
  readonly sourceStage8Decision: string;
  readonly sourceChainExecuted: boolean;
  readonly validationValid: boolean;
  readonly stage9EntryReady: boolean;
  readonly confirmationsSatisfied: boolean;
}): {
  readonly checklist: readonly RuntimeControlBundleChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeControlBundleChecklistItem[];
} {
  const checklist: RuntimeControlBundleChecklistItem[] = [
    {
      item: "stage8_vertical_slice_ready",
      satisfied: input.sourceStage8Decision === "stage8_minimal_vertical_slice_ready",
      reason: "sourceStage8Decision",
    },
    {
      item: "stage8_chain_executed",
      satisfied: input.sourceChainExecuted,
      reason: "sourceChainExecuted",
    },
    {
      item: "control_items_valid",
      satisfied: input.validationValid,
      reason: "validationValid",
    },
    {
      item: "stage9_entry_ready",
      satisfied: input.stage9EntryReady,
      reason: "stage9EntryReady",
    },
    {
      item: "confirmations_satisfied",
      satisfied: input.confirmationsSatisfied,
      reason: "confirmationsSatisfied",
    },
  ];

  const boundaryChecklist: RuntimeControlBundleChecklistItem[] = [
    {
      item: "actualApiRouteImplementedInThisStep=false",
      satisfied: true,
      reason: "Stage 8-B design-only",
    },
    {
      item: "actualRunnerImplementedInThisStep=false",
      satisfied: true,
      reason: "Stage 8-B design-only",
    },
    {
      item: "stage9ImplementationAllowedInThisStep=false",
      satisfied: true,
      reason: "Stage 8-B design-only",
    },
  ];

  return { checklist, boundaryChecklist };
}
