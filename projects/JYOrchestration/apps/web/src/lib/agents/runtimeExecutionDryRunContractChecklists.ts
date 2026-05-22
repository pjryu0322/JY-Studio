/**
 * Stage 6-E dry-run contract checklist builders (read-only).
 */

import type {
  ParsedRuntimeExecutionDryRunContractInput,
  RuntimeExecutionDryRunContractChecklistItem,
  RuntimeExecutionDryRunContractItem,
} from "@/lib/agents/runtimeExecutionDryRunContractTypes";

type ChecklistEntry = {
  readonly item: string;
  readonly area: RuntimeExecutionDryRunContractChecklistItem["area"];
  readonly satisfied: boolean;
  readonly detail: string;
};

function mapChecklist(entries: readonly ChecklistEntry[]): RuntimeExecutionDryRunContractChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    area: entry.area,
    satisfied: entry.satisfied,
    reason: `${entry.item}: ${entry.satisfied ? "satisfied" : "not satisfied"} — ${entry.detail}`,
  }));
}

export function buildRuntimeExecutionDryRunContractChecklists(input: {
  readonly dryRunContractItems: readonly RuntimeExecutionDryRunContractItem[];
  readonly parsed: ParsedRuntimeExecutionDryRunContractInput;
}): {
  readonly dryRunChecklist: readonly RuntimeExecutionDryRunContractChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeExecutionDryRunContractChecklistItem[];
} {
  const itemByArea = new Map(input.dryRunContractItems.map((item) => [item.area, item] as const));

  const dryRunChecklist = mapChecklist([
    {
      item: "7 dry-run contract items generated",
      area: "dry_run_boundary",
      satisfied: input.dryRunContractItems.length === 7,
      detail: `dryRunContractItemCount=${input.dryRunContractItems.length}`,
    },
    {
      item: "dry_run_request item present",
      area: "dry_run_request",
      satisfied: itemByArea.has("dry_run_request"),
      detail: "dry_run_request present",
    },
    {
      item: "dry_run_plan item present",
      area: "dry_run_plan",
      satisfied: itemByArea.has("dry_run_plan"),
      detail: "dry_run_plan present",
    },
    {
      item: "dry_run_step item present",
      area: "dry_run_step",
      satisfied: itemByArea.has("dry_run_step"),
      detail: "dry_run_step present",
    },
    {
      item: "dry_run_result item present",
      area: "dry_run_result",
      satisfied: itemByArea.has("dry_run_result"),
      detail: "dry_run_result present",
    },
    {
      item: "dry_run_finding item present",
      area: "dry_run_finding",
      satisfied: itemByArea.has("dry_run_finding"),
      detail: "dry_run_finding present",
    },
    {
      item: "dry_run_approval item present",
      area: "dry_run_approval",
      satisfied: itemByArea.has("dry_run_approval"),
      detail: "dry_run_approval present",
    },
    {
      item: "dry_run_rollback item present",
      area: "dry_run_rollback",
      satisfied: itemByArea.has("dry_run_rollback"),
      detail: "dry_run_rollback present",
    },
    {
      item: "dry-run contract confirmed",
      area: "dry_run_boundary",
      satisfied: input.parsed.runtimeExecutionDryRunContractConfirmed,
      detail: `runtimeExecutionDryRunContractConfirmed=${input.parsed.runtimeExecutionDryRunContractConfirmed}`,
    },
    {
      item: "dry-run no-runner confirmed",
      area: "dry_run_boundary",
      satisfied: input.parsed.runtimeExecutionDryRunNoRunnerConfirmed,
      detail: `runtimeExecutionDryRunNoRunnerConfirmed=${input.parsed.runtimeExecutionDryRunNoRunnerConfirmed}`,
    },
  ]);

  const boundaryChecklist = mapChecklist([
    {
      item: "actualRuntimeExecutionAllowedInThisStep=false",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualRuntimeExecutionAllowedInThisStep=false",
    },
    {
      item: "actualDryRunRunnerAllowedInThisStep=false",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualDryRunRunnerAllowedInThisStep=false",
    },
    {
      item: "actualExecutionRunnerAllowedInThisStep=false",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualExecutionRunnerAllowedInThisStep=false",
    },
    {
      item: "actualExecutionWireAllowedInThisStep=false",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualExecutionWireAllowedInThisStep=false",
    },
    {
      item: "actualPersistenceAllowedInThisStep=false",
      area: "persistence_boundary",
      satisfied: true,
      detail: "actualPersistenceAllowedInThisStep=false",
    },
    {
      item: "actualSchemaMigrationAllowedInThisStep=false",
      area: "schema_boundary",
      satisfied: true,
      detail: "actualSchemaMigrationAllowedInThisStep=false",
    },
    {
      item: "actualExternalSideEffectAllowedInThisStep=false",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualExternalSideEffectAllowedInThisStep=false",
    },
    {
      item: "dry-run boundary reviewed",
      area: "dry_run_boundary",
      satisfied: input.parsed.runtimeExecutionDryRunBoundaryReviewed,
      detail: `runtimeExecutionDryRunBoundaryReviewed=${input.parsed.runtimeExecutionDryRunBoundaryReviewed}`,
    },
  ]);

  return { dryRunChecklist, boundaryChecklist };
}
