/**
 * Stage 7-C contract bundle closure checklist builders (read-only).
 */

import type { RuntimeApiContractDesignReport } from "@/lib/agents/runtimeApiContractDesignTypes";
import type {
  ParsedRuntimeContractBundleClosureInput,
  RuntimeContractBundleClosureChecklistItem,
} from "@/lib/agents/runtimeContractBundleClosureTypes";

type ChecklistEntry = {
  readonly item: string;
  readonly area: RuntimeContractBundleClosureChecklistItem["area"];
  readonly satisfied: boolean;
  readonly detail: string;
};

function mapChecklist(entries: readonly ChecklistEntry[]): RuntimeContractBundleClosureChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    area: entry.area,
    satisfied: entry.satisfied,
    reason: `${entry.item}: ${entry.satisfied ? "satisfied" : "not satisfied"} — ${entry.detail}`,
  }));
}

export function buildRuntimeContractBundleClosureChecklists(input: {
  readonly parsed: ParsedRuntimeContractBundleClosureInput;
  readonly source: RuntimeApiContractDesignReport;
  readonly bundleItemsValid: boolean;
  readonly bundleItemCount: number;
  readonly stage8EntryReady: boolean;
}): {
  readonly closureChecklist: readonly RuntimeContractBundleClosureChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeContractBundleClosureChecklistItem[];
  readonly stage8EntryChecklist: readonly RuntimeContractBundleClosureChecklistItem[];
} {
  const sourceReady = input.source.decision === "ready_for_execution_runner_contract_design";
  const designOnlyMatch =
    input.source.endpointContractCount > 0 &&
    input.source.endpointDesignOnlyCount === input.source.endpointContractCount;

  const closureChecklist = mapChecklist([
    {
      item: "source_api_contract_ready",
      area: "api_contract",
      satisfied: sourceReady,
      detail: "Stage 7-B API contract design is ready",
    },
    {
      item: "endpoint_contracts_design_only",
      area: "api_contract",
      satisfied: designOnlyMatch && input.source.implementedEndpointCount === 0,
      detail: `endpointDesignOnlyCount=${input.source.endpointDesignOnlyCount}`,
    },
    {
      item: "bundle_items_generated",
      area: "api_contract",
      satisfied: input.bundleItemCount >= 12,
      detail: `bundleItemCount=${input.bundleItemCount}`,
    },
    {
      item: "bundle_items_validated",
      area: "api_contract",
      satisfied: input.bundleItemsValid,
      detail: "bundle items validation",
    },
    {
      item: "contract_bundle_closure_only",
      area: "no_run_boundary",
      satisfied: true,
      detail: "contractBundleClosureOnly=true",
    },
  ]);

  const boundaryChecklist = mapChecklist([
    {
      item: "no_actual_api_endpoint",
      area: "no_run_boundary",
      satisfied: input.source.actualApiEndpointImplementedInThisStep === false,
      detail: "actualApiEndpointImplementedInThisStep=false",
    },
    {
      item: "no_actual_runtime_execution",
      area: "no_run_boundary",
      satisfied: input.source.sourceActualRuntimeExecutionAllowedInThisStep === false,
      detail: "sourceActualRuntimeExecutionAllowedInThisStep=false",
    },
    {
      item: "no_actual_execution_runner",
      area: "runner_contract",
      satisfied: input.source.sourceActualExecutionRunnerAllowedInThisStep === false,
      detail: "sourceActualExecutionRunnerAllowedInThisStep=false",
    },
    {
      item: "no_actual_dry_run_runner",
      area: "dry_run_contract",
      satisfied: input.source.sourceActualDryRunRunnerAllowedInThisStep === false,
      detail: "sourceActualDryRunRunnerAllowedInThisStep=false",
    },
    {
      item: "no_actual_execution_wire",
      area: "no_run_boundary",
      satisfied: input.source.sourceActualExecutionWireAllowedInThisStep === false,
      detail: "sourceActualExecutionWireAllowedInThisStep=false",
    },
    {
      item: "no_actual_persistence",
      area: "persistence_boundary",
      satisfied: input.source.sourceActualPersistenceAllowedInThisStep === false,
      detail: "sourceActualPersistenceAllowedInThisStep=false",
    },
    {
      item: "no_actual_schema_migration",
      area: "schema_boundary",
      satisfied: input.source.sourceActualSchemaMigrationAllowedInThisStep === false,
      detail: "sourceActualSchemaMigrationAllowedInThisStep=false",
    },
    {
      item: "no_cursor_github_wire",
      area: "cursor_github_wire_contract",
      satisfied: input.source.sourceActualCursorGithubWireAllowedInThisStep === false,
      detail: "sourceActualCursorGithubWireAllowedInThisStep=false",
    },
    {
      item: "no_connector_routing_change",
      area: "connector_gateway_contract",
      satisfied: input.source.sourceActualConnectorRoutingChangeAllowedInThisStep === false,
      detail: "sourceActualConnectorRoutingChangeAllowedInThisStep=false",
    },
    {
      item: "no_ui_implementation",
      area: "no_run_boundary",
      satisfied: input.source.sourceActualUiImplementationAllowedInThisStep === false,
      detail: "sourceActualUiImplementationAllowedInThisStep=false",
    },
  ]);

  const stage8EntryChecklist = mapChecklist([
    {
      item: "stage8_entry_candidate_defined",
      area: "stage8_entry",
      satisfied: input.stage8EntryReady,
      detail: "stage8-minimal-vertical-slice-entry defined",
    },
    {
      item: "stage8_minimal_vertical_slice_scope_defined",
      area: "stage8_entry",
      satisfied: input.parsed.runtimeContractBundleStage8EntryReviewed,
      detail: "runtimeContractBundleStage8EntryReviewed",
    },
    {
      item: "stage8_separated_work_defined",
      area: "separated_work",
      satisfied: input.parsed.runtimeContractBundleSeparatedWorkConfirmed,
      detail: "runtimeContractBundleSeparatedWorkConfirmed",
    },
    {
      item: "stage8_requires_operator_approval",
      area: "approval_gate",
      satisfied: input.parsed.runtimeContractBundleReviewed,
      detail: "runtimeContractBundleReviewed",
    },
    {
      item: "stage8_requires_no_db_schema_by_default",
      area: "schema_boundary",
      satisfied: input.parsed.runtimeContractBundleNoImplementationConfirmed,
      detail: "runtimeContractBundleNoImplementationConfirmed",
    },
  ]);

  return { closureChecklist, boundaryChecklist, stage8EntryChecklist };
}
