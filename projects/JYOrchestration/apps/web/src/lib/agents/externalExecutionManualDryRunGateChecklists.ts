/**
 * Stage 12-A manual dry-run gate checklists (read-only).
 */

import type { ExternalExecutionManualDryRunGateChecklistItem } from "@/lib/agents/externalExecutionManualDryRunGateTypes";

export function buildExternalExecutionManualDryRunGateChecklists(input: {
  readonly sourceStage11Decision: string;
  readonly sourceStage12EntryReady: boolean;
  readonly validationValid: boolean;
  readonly stage13EntryReady: boolean;
  readonly confirmationsSatisfied: boolean;
}): {
  readonly checklist: readonly ExternalExecutionManualDryRunGateChecklistItem[];
  readonly boundaryChecklist: readonly ExternalExecutionManualDryRunGateChecklistItem[];
} {
  const checklist: ExternalExecutionManualDryRunGateChecklistItem[] = [
    {
      item: "source Stage 11-A dry-run package ready",
      satisfied: input.sourceStage11Decision === "stage11_external_execution_dry_run_package_ready",
      reason: "sourceStage11Decision",
    },
    {
      item: "Stage 12 entry ready",
      satisfied: input.sourceStage12EntryReady,
      reason: "sourceStage12EntryReady",
    },
    {
      item: "manual gate items valid",
      satisfied: input.validationValid,
      reason: "validationValid",
    },
    {
      item: "Stage 13 candidate defined",
      satisfied: input.stage13EntryReady,
      reason: "stage13EntryReady",
    },
    {
      item: "operator confirmations satisfied",
      satisfied: input.confirmationsSatisfied,
      reason: "confirmationsSatisfied",
    },
  ];

  const boundaryChecklist: ExternalExecutionManualDryRunGateChecklistItem[] = [
    {
      item: "actual external invocation disallowed",
      satisfied: true,
      reason: "Stage 12-A read-only manual gate",
    },
    {
      item: "actual adapter side-effect disallowed",
      satisfied: true,
      reason: "Stage 12-A read-only manual gate",
    },
    {
      item: "agent registry mutation disallowed",
      satisfied: true,
      reason: "Stage 12-A read-only manual gate",
    },
  ];

  return { checklist, boundaryChecklist };
}
