/**
 * Stage 6-F contract closure checklist builders (read-only).
 */

import { STAGE6_F_SEPARATED_WORK_ITEMS } from "@/lib/agents/runtimeExecutionContractClosureConstants";
import type { RuntimeExecutionDryRunContractReport } from "@/lib/agents/runtimeExecutionDryRunContractTypes";
import type {
  ParsedRuntimeExecutionContractClosureInput,
  RuntimeExecutionContractClosureChecklistItem,
} from "@/lib/agents/runtimeExecutionContractClosureTypes";

type ChecklistEntry = {
  readonly item: string;
  readonly area: RuntimeExecutionContractClosureChecklistItem["area"];
  readonly satisfied: boolean;
  readonly detail: string;
};

function mapChecklist(entries: readonly ChecklistEntry[]): RuntimeExecutionContractClosureChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    area: entry.area,
    satisfied: entry.satisfied,
    reason: `${entry.item}: ${entry.satisfied ? "satisfied" : "not satisfied"} — ${entry.detail}`,
  }));
}

export function buildRuntimeExecutionContractClosureChecklists(input: {
  readonly parsed: ParsedRuntimeExecutionContractClosureInput;
  readonly source: RuntimeExecutionDryRunContractReport;
}): {
  readonly closureChecklist: readonly RuntimeExecutionContractClosureChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeExecutionContractClosureChecklistItem[];
  readonly handoffChecklist: readonly RuntimeExecutionContractClosureChecklistItem[];
} {
  const sourceReady = input.source.decision === "ready_for_runtime_execution_contract_closure";

  const closureChecklist = mapChecklist([
    {
      item: "stage_6_a_baseline_closed",
      area: "runtime_model_baseline",
      satisfied: sourceReady,
      detail: "Stage 6-A baseline included in closed chain",
    },
    {
      item: "stage_6_b_candidate_closed",
      area: "runtime_model_candidate",
      satisfied: sourceReady,
      detail: "Stage 6-B candidate included in closed chain",
    },
    {
      item: "stage_6_c_review_gate_closed",
      area: "runtime_model_review_gate",
      satisfied: sourceReady,
      detail: "Stage 6-C review gate included in closed chain",
    },
    {
      item: "stage_6_d_contract_candidate_closed",
      area: "runtime_contract_candidate",
      satisfied: sourceReady,
      detail: "Stage 6-D contract candidate included in closed chain",
    },
    {
      item: "stage_6_e_dry_run_contract_closed",
      area: "runtime_dry_run_contract",
      satisfied: sourceReady,
      detail: "Stage 6-E dry-run contract included in closed chain",
    },
    {
      item: "stage_6_closure_confirmation_complete",
      area: "stage6_chain_closure",
      satisfied: input.parsed.confirmationsSatisfied,
      detail: `confirmationsSatisfied=${input.parsed.confirmationsSatisfied}`,
    },
  ]);

  const boundaryChecklist = mapChecklist([
    {
      item: "no_actual_runtime_execution",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualRuntimeExecutionAllowedInThisStep=false",
    },
    {
      item: "no_actual_execution_runner",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualExecutionRunnerAllowedInThisStep=false",
    },
    {
      item: "no_actual_dry_run_runner",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualDryRunRunnerAllowedInThisStep=false",
    },
    {
      item: "no_actual_persistence",
      area: "persistence_boundary",
      satisfied: true,
      detail: "actualPersistenceAllowedInThisStep=false",
    },
    {
      item: "no_actual_schema_migration",
      area: "schema_boundary",
      satisfied: true,
      detail: "actualSchemaMigrationAllowedInThisStep=false",
    },
    {
      item: "no_connector_routing_change",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualConnectorRoutingChangeAllowedInThisStep=false",
    },
    {
      item: "no_cursor_github_wire",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualCursorGithubWireAllowedInThisStep=false",
    },
  ]);

  const handoffChecklist = mapChecklist([
    {
      item: "separated_work_items_defined",
      area: "separated_work",
      satisfied: STAGE6_F_SEPARATED_WORK_ITEMS.length > 0,
      detail: `separatedWorkItemCount=${STAGE6_F_SEPARATED_WORK_ITEMS.length}`,
    },
    {
      item: "stage7_requires_separate_approval",
      area: "stage6_chain_closure",
      satisfied: input.parsed.runtimeExecutionStage7HandoffReviewed,
      detail: `runtimeExecutionStage7HandoffReviewed=${input.parsed.runtimeExecutionStage7HandoffReviewed}`,
    },
    {
      item: "implementation_prs_are_out_of_scope",
      area: "separated_work",
      satisfied: input.parsed.runtimeExecutionSeparatedWorkReviewed,
      detail: `runtimeExecutionSeparatedWorkReviewed=${input.parsed.runtimeExecutionSeparatedWorkReviewed}`,
    },
  ]);

  return { closureChecklist, boundaryChecklist, handoffChecklist };
}
