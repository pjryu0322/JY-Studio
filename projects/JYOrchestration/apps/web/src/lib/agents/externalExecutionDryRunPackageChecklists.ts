/**
 * Stage 11-A dry-run package checklists (read-only).
 */

import type { ExternalExecutionDryRunPackageChecklistItem } from "@/lib/agents/externalExecutionDryRunPackageTypes";

export function buildExternalExecutionDryRunPackageChecklists(input: {
  readonly sourceStage10Decision: string;
  readonly sourceStage11EntryReady: boolean;
  readonly validationValid: boolean;
  readonly stage12EntryReady: boolean;
  readonly confirmationsSatisfied: boolean;
}): {
  readonly checklist: readonly ExternalExecutionDryRunPackageChecklistItem[];
  readonly boundaryChecklist: readonly ExternalExecutionDryRunPackageChecklistItem[];
} {
  const checklist: ExternalExecutionDryRunPackageChecklistItem[] = [
    {
      item: "source Stage 10-A boundary ready",
      satisfied: input.sourceStage10Decision === "stage10_external_execution_adapter_boundary_ready",
      reason: "sourceStage10Decision",
    },
    {
      item: "Stage 11 entry ready",
      satisfied: input.sourceStage11EntryReady,
      reason: "sourceStage11EntryReady",
    },
    {
      item: "dry-run items valid",
      satisfied: input.validationValid,
      reason: "validationValid",
    },
    {
      item: "Stage 12 candidate defined",
      satisfied: input.stage12EntryReady,
      reason: "stage12EntryReady",
    },
    {
      item: "operator confirmations satisfied",
      satisfied: input.confirmationsSatisfied,
      reason: "confirmationsSatisfied",
    },
  ];

  const boundaryChecklist: ExternalExecutionDryRunPackageChecklistItem[] = [
    {
      item: "actual Cursor execution disallowed",
      satisfied: true,
      reason: "Stage 11-A read-only dry-run package",
    },
    {
      item: "actual GitHub write disallowed",
      satisfied: true,
      reason: "Stage 11-A read-only dry-run package",
    },
    {
      item: "actual Connector Gateway call disallowed",
      satisfied: true,
      reason: "Stage 11-A read-only dry-run package",
    },
    {
      item: "agent registry mutation disallowed",
      satisfied: true,
      reason: "Stage 11-A read-only dry-run package",
    },
    {
      item: "actual UI implementation disallowed",
      satisfied: true,
      reason: "Stage 11-A read-only dry-run package",
    },
  ];

  return { checklist, boundaryChecklist };
}
