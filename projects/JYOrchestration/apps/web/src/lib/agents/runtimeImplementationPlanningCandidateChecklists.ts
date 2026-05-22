/**
 * Stage 7-A implementation planning candidate checklist builders (read-only).
 */

import { STAGE7_A_REQUIRED_PLANNING_ITEM_IDS } from "@/lib/agents/runtimeImplementationPlanningCandidateConstants";
import type { RuntimeExecutionContractClosureReport } from "@/lib/agents/runtimeExecutionContractClosureTypes";
import type {
  ParsedRuntimeImplementationPlanningCandidateInput,
  RuntimeImplementationPlanningCandidateChecklistItem,
} from "@/lib/agents/runtimeImplementationPlanningCandidateTypes";

type ChecklistEntry = {
  readonly item: string;
  readonly area: RuntimeImplementationPlanningCandidateChecklistItem["area"];
  readonly satisfied: boolean;
  readonly detail: string;
};

function mapChecklist(
  entries: readonly ChecklistEntry[],
): RuntimeImplementationPlanningCandidateChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    area: entry.area,
    satisfied: entry.satisfied,
    reason: `${entry.item}: ${entry.satisfied ? "satisfied" : "not satisfied"} — ${entry.detail}`,
  }));
}

export function buildRuntimeImplementationPlanningCandidateChecklists(input: {
  readonly parsed: ParsedRuntimeImplementationPlanningCandidateInput;
  readonly source: RuntimeExecutionContractClosureReport;
  readonly planningItemsValid: boolean;
  readonly planningItemCount: number;
  readonly separatedPrCandidateCount: number;
}): {
  readonly planningChecklist: readonly RuntimeImplementationPlanningCandidateChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeImplementationPlanningCandidateChecklistItem[];
  readonly approvalChecklist: readonly RuntimeImplementationPlanningCandidateChecklistItem[];
} {
  const sourceReady = input.source.decision === "stage6_runtime_execution_contract_closed";

  const planningChecklist = mapChecklist([
    {
      item: "stage6_contract_closure_ready",
      area: "implementation_planning",
      satisfied: sourceReady,
      detail: "Stage 6-F contract closure is ready",
    },
    {
      item: "planning_items_generated",
      area: "implementation_planning",
      satisfied: input.planningItemCount >= STAGE7_A_REQUIRED_PLANNING_ITEM_IDS.length,
      detail: `planningItemCount=${input.planningItemCount}`,
    },
    {
      item: "planning_items_validated",
      area: "implementation_planning",
      satisfied: input.planningItemsValid,
      detail: "planning items validation",
    },
    {
      item: "separate_pr_candidates_defined",
      area: "separated_work",
      satisfied: input.separatedPrCandidateCount > 0,
      detail: `separatedPrCandidateCount=${input.separatedPrCandidateCount}`,
    },
    {
      item: "rollback_planning_reviewed",
      area: "rollback",
      satisfied: input.parsed.runtimeImplementationRollbackPlanReviewed,
      detail: "runtimeImplementationRollbackPlanReviewed",
    },
  ]);

  const boundaryChecklist = mapChecklist([
    {
      item: "no_actual_runtime_execution",
      area: "runtime_api",
      satisfied: input.source.actualRuntimeExecutionAllowedInThisStep === false,
      detail: "actualRuntimeExecutionAllowedInThisStep=false",
    },
    {
      item: "no_actual_execution_runner",
      area: "execution_runner",
      satisfied: input.source.actualExecutionRunnerAllowedInThisStep === false,
      detail: "actualExecutionRunnerAllowedInThisStep=false",
    },
    {
      item: "no_actual_dry_run_runner",
      area: "dry_run_runner",
      satisfied: input.source.actualDryRunRunnerAllowedInThisStep === false,
      detail: "actualDryRunRunnerAllowedInThisStep=false",
    },
    {
      item: "no_actual_persistence",
      area: "persistence",
      satisfied: input.source.actualPersistenceAllowedInThisStep === false,
      detail: "actualPersistenceAllowedInThisStep=false",
    },
    {
      item: "no_actual_schema_migration",
      area: "schema_migration",
      satisfied: input.source.actualSchemaMigrationAllowedInThisStep === false,
      detail: "actualSchemaMigrationAllowedInThisStep=false",
    },
    {
      item: "no_cursor_github_wire",
      area: "cursor_github_wire",
      satisfied: input.source.actualCursorGithubWireAllowedInThisStep === false,
      detail: "actualCursorGithubWireAllowedInThisStep=false",
    },
    {
      item: "no_connector_routing_change",
      area: "connector_gateway_routing",
      satisfied: input.source.actualConnectorRoutingChangeAllowedInThisStep === false,
      detail: "actualConnectorRoutingChangeAllowedInThisStep=false",
    },
    {
      item: "no_ui_implementation",
      area: "ui",
      satisfied: true,
      detail: "actualUiImplementationAllowedInThisStep=false",
    },
  ]);

  const approvalChecklist = mapChecklist([
    {
      item: "operator_approval_required",
      area: "approval",
      satisfied: input.parsed.runtimeImplementationOperatorApprovalRequiredConfirmed,
      detail: "runtimeImplementationOperatorApprovalRequiredConfirmed",
    },
    {
      item: "implementation_requires_separate_pr",
      area: "separated_work",
      satisfied: input.parsed.runtimeImplementationSeparatePrConfirmed,
      detail: "runtimeImplementationSeparatePrConfirmed",
    },
    {
      item: "schema_migration_requires_separate_approval",
      area: "schema_migration",
      satisfied: sourceReady,
      detail: "schema migration approval PR planned",
    },
    {
      item: "persistence_requires_separate_approval",
      area: "persistence",
      satisfied: sourceReady,
      detail: "persistence design PR planned",
    },
  ]);

  return { planningChecklist, boundaryChecklist, approvalChecklist };
}
