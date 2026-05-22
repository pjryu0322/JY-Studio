/**
 * Stage 10-A external execution adapter boundary checklists (read-only).
 */

import type { ExternalExecutionAdapterBoundaryChecklistItem } from "@/lib/agents/externalExecutionAdapterBoundaryTypes";

export function buildExternalExecutionAdapterBoundaryChecklists(input: {
  readonly sourceStage9Decision: string;
  readonly sourceStage10EntryReady: boolean;
  readonly validationValid: boolean;
  readonly stage11EntryReady: boolean;
  readonly confirmationsSatisfied: boolean;
}): {
  readonly checklist: readonly ExternalExecutionAdapterBoundaryChecklistItem[];
  readonly boundaryChecklist: readonly ExternalExecutionAdapterBoundaryChecklistItem[];
} {
  const checklist: ExternalExecutionAdapterBoundaryChecklistItem[] = [
    {
      item: "source Stage 9-B closure ready",
      satisfied: input.sourceStage9Decision === "stage9_runtime_api_mvp_closed",
      reason: "sourceStage9Decision",
    },
    {
      item: "Stage 10 entry boundary ready",
      satisfied: input.sourceStage10EntryReady,
      reason: "sourceStage10EntryReady",
    },
    {
      item: "adapter boundary items valid",
      satisfied: input.validationValid,
      reason: "validationValid",
    },
    {
      item: "Stage 11 candidate defined",
      satisfied: input.stage11EntryReady,
      reason: "stage11EntryReady",
    },
    {
      item: "operator confirmations satisfied",
      satisfied: input.confirmationsSatisfied,
      reason: "confirmationsSatisfied",
    },
  ];

  const boundaryChecklist: ExternalExecutionAdapterBoundaryChecklistItem[] = [
    {
      item: "actual Cursor execution disallowed",
      satisfied: true,
      reason: "Stage 10-A read-only boundary design",
    },
    {
      item: "actual GitHub write disallowed",
      satisfied: true,
      reason: "Stage 10-A read-only boundary design",
    },
    {
      item: "actual Connector Gateway call disallowed",
      satisfied: true,
      reason: "Stage 10-A read-only boundary design",
    },
    {
      item: "actual DB persistence disallowed",
      satisfied: true,
      reason: "Stage 10-A read-only boundary design",
    },
    {
      item: "actual production runner disallowed",
      satisfied: true,
      reason: "Stage 10-A read-only boundary design",
    },
    {
      item: "actual UI implementation disallowed",
      satisfied: true,
      reason: "Stage 10-A read-only boundary design",
    },
  ];

  return { checklist, boundaryChecklist };
}
