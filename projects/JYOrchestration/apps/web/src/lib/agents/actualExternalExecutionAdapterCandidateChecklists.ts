/**
 * Stage 13-A adapter candidate checklists (read-only).
 */

import type { ActualExternalExecutionAdapterCandidateChecklistItem } from "@/lib/agents/actualExternalExecutionAdapterCandidateTypes";

export function buildActualExternalExecutionAdapterCandidateChecklists(input: {
  readonly sourceStage12Decision: string;
  readonly sourceStage13EntryReady: boolean;
  readonly validationValid: boolean;
  readonly stage14EntryReady: boolean;
  readonly confirmationsSatisfied: boolean;
}): {
  readonly checklist: readonly ActualExternalExecutionAdapterCandidateChecklistItem[];
  readonly boundaryChecklist: readonly ActualExternalExecutionAdapterCandidateChecklistItem[];
} {
  const checklist: ActualExternalExecutionAdapterCandidateChecklistItem[] = [
    {
      item: "source Stage 12-A manual dry-run gate ready",
      satisfied: input.sourceStage12Decision === "stage12_external_execution_manual_dry_run_gate_ready",
      reason: "sourceStage12Decision",
    },
    {
      item: "Stage 13 entry ready",
      satisfied: input.sourceStage13EntryReady,
      reason: "sourceStage13EntryReady",
    },
    {
      item: "adapter candidate items valid",
      satisfied: input.validationValid,
      reason: "validationValid",
    },
    {
      item: "Stage 14 candidate defined",
      satisfied: input.stage14EntryReady,
      reason: "stage14EntryReady",
    },
    {
      item: "operator confirmations satisfied",
      satisfied: input.confirmationsSatisfied,
      reason: "confirmationsSatisfied",
    },
  ];

  const boundaryChecklist: ActualExternalExecutionAdapterCandidateChecklistItem[] = [
    {
      item: "actual external execution disallowed",
      satisfied: true,
      reason: "Stage 13-A read-only candidate boundary",
    },
    {
      item: "adapter credential usage disallowed",
      satisfied: true,
      reason: "Stage 13-A read-only candidate boundary",
    },
    {
      item: "network side-effect disallowed",
      satisfied: true,
      reason: "Stage 13-A read-only candidate boundary",
    },
  ];

  return { checklist, boundaryChecklist };
}
