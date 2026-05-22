/**
 * Stage 6-D contract candidate checklist builders (read-only).
 */

import type {
  ParsedRuntimeExecutionContractCandidateInput,
  RuntimeExecutionContractArea,
  RuntimeExecutionContractCandidateChecklistItem,
  RuntimeExecutionContractCandidateItem,
} from "@/lib/agents/runtimeExecutionContractCandidateTypes";

type ChecklistEntry = {
  readonly item: string;
  readonly area: RuntimeExecutionContractArea;
  readonly satisfied: boolean;
  readonly detail: string;
};

function mapChecklist(entries: readonly ChecklistEntry[]): RuntimeExecutionContractCandidateChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    area: entry.area,
    satisfied: entry.satisfied,
    reason: `${entry.item}: ${entry.satisfied ? "satisfied" : "not satisfied"} — ${entry.detail}`,
  }));
}

export function buildRuntimeExecutionContractCandidateChecklists(input: {
  readonly contractCandidates: readonly RuntimeExecutionContractCandidateItem[];
  readonly parsed: ParsedRuntimeExecutionContractCandidateInput;
}): {
  readonly contractChecklist: readonly RuntimeExecutionContractCandidateChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeExecutionContractCandidateChecklistItem[];
  readonly dryRunChecklist: readonly RuntimeExecutionContractCandidateChecklistItem[];
} {
  const contractByArea = new Map(
    input.contractCandidates.map((c) => [c.area, c] as const),
  );

  const contractChecklist = mapChecklist([
    {
      item: "7 contract candidates generated",
      area: "boundary_contract",
      satisfied: input.contractCandidates.length === 7,
      detail: `contractCandidateCount=${input.contractCandidates.length}`,
    },
    {
      item: "request contract reviewed",
      area: "request_contract",
      satisfied: contractByArea.has("request_contract"),
      detail: "request_contract present",
    },
    {
      item: "plan contract reviewed",
      area: "plan_contract",
      satisfied: contractByArea.has("plan_contract"),
      detail: "plan_contract present",
    },
    {
      item: "step contract reviewed",
      area: "step_contract",
      satisfied: contractByArea.has("step_contract"),
      detail: "step_contract present",
    },
    {
      item: "result contract reviewed",
      area: "result_contract",
      satisfied: contractByArea.has("result_contract"),
      detail: "result_contract present",
    },
    {
      item: "finding contract reviewed",
      area: "finding_contract",
      satisfied: contractByArea.has("finding_contract"),
      detail: "finding_contract present",
    },
    {
      item: "approval contract reviewed",
      area: "approval_contract",
      satisfied: contractByArea.has("approval_contract"),
      detail: "approval_contract present",
    },
    {
      item: "rollback contract reviewed",
      area: "rollback_contract",
      satisfied: contractByArea.has("rollback_contract"),
      detail: "rollback_contract present",
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
      item: "actualCursorGithubWireAllowedInThisStep=false",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualCursorGithubWireAllowedInThisStep=false",
    },
    {
      item: "actualConnectorRoutingChangeAllowedInThisStep=false",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualConnectorRoutingChangeAllowedInThisStep=false",
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
  ]);

  const dryRunChecklist = mapChecklist([
    {
      item: "dry-run contract candidate only",
      area: "dry_run_contract",
      satisfied: input.parsed.runtimeExecutionDryRunContractReviewed,
      detail: `runtimeExecutionDryRunContractReviewed=${input.parsed.runtimeExecutionDryRunContractReviewed}`,
    },
    {
      item: "dry-run runner not implemented",
      area: "dry_run_contract",
      satisfied: true,
      detail: "actualExecutionRunnerAllowedInThisStep=false",
    },
    {
      item: "dry-run result persistence not implemented",
      area: "dry_run_contract",
      satisfied: true,
      detail: "actualPersistenceAllowedInThisStep=false",
    },
    {
      item: "dry-run approval remains separated",
      area: "dry_run_contract",
      satisfied: input.parsed.runtimeExecutionApprovalContractReviewed,
      detail: `runtimeExecutionApprovalContractReviewed=${input.parsed.runtimeExecutionApprovalContractReviewed}`,
    },
  ]);

  return { contractChecklist, boundaryChecklist, dryRunChecklist };
}
