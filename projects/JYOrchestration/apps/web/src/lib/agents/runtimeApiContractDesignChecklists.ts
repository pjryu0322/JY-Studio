/**
 * Stage 7-B runtime API contract design checklist builders (read-only).
 */

import { STAGE7_B_REQUIRED_ENDPOINT_CONTRACT_IDS } from "@/lib/agents/runtimeApiContractDesignConstants";
import type { RuntimeImplementationPlanningCandidateReport } from "@/lib/agents/runtimeImplementationPlanningCandidateTypes";
import type {
  ParsedRuntimeApiContractDesignInput,
  RuntimeApiContractDesignChecklistItem,
} from "@/lib/agents/runtimeApiContractDesignTypes";

type ChecklistEntry = {
  readonly item: string;
  readonly area: RuntimeApiContractDesignChecklistItem["area"];
  readonly satisfied: boolean;
  readonly detail: string;
};

function mapChecklist(entries: readonly ChecklistEntry[]): RuntimeApiContractDesignChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    area: entry.area,
    satisfied: entry.satisfied,
    reason: `${entry.item}: ${entry.satisfied ? "satisfied" : "not satisfied"} — ${entry.detail}`,
  }));
}

export function buildRuntimeApiContractDesignChecklists(input: {
  readonly parsed: ParsedRuntimeApiContractDesignInput;
  readonly source: RuntimeImplementationPlanningCandidateReport;
  readonly endpointContractsValid: boolean;
  readonly endpointContractCount: number;
  readonly statusTransitionCount: number;
  readonly errorCodeCount: number;
  readonly auditEventCount: number;
}): {
  readonly apiChecklist: readonly RuntimeApiContractDesignChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeApiContractDesignChecklistItem[];
  readonly approvalChecklist: readonly RuntimeApiContractDesignChecklistItem[];
} {
  const sourceReady = input.source.decision === "ready_for_runtime_implementation_pr_planning";

  const apiChecklist = mapChecklist([
    {
      item: "source_planning_ready",
      area: "api_contract",
      satisfied: sourceReady,
      detail: "Stage 7-A planning candidate is ready",
    },
    {
      item: "endpoint_contracts_generated",
      area: "api_contract",
      satisfied: input.endpointContractCount >= STAGE7_B_REQUIRED_ENDPOINT_CONTRACT_IDS.length,
      detail: `endpointContractCount=${input.endpointContractCount}`,
    },
    {
      item: "endpoint_contracts_validated",
      area: "api_contract",
      satisfied: input.endpointContractsValid,
      detail: "endpoint contracts validation",
    },
    {
      item: "status_transitions_defined",
      area: "status_contract",
      satisfied: input.statusTransitionCount > 0,
      detail: `statusTransitionCount=${input.statusTransitionCount}`,
    },
    {
      item: "error_codes_defined",
      area: "error_contract",
      satisfied: input.errorCodeCount > 0,
      detail: `errorCodeCount=${input.errorCodeCount}`,
    },
    {
      item: "audit_events_defined",
      area: "audit_contract",
      satisfied: input.auditEventCount > 0,
      detail: `auditEventCount=${input.auditEventCount}`,
    },
  ]);

  const boundaryChecklist = mapChecklist([
    {
      item: "no_actual_api_endpoint",
      area: "api_contract",
      satisfied: true,
      detail: "actualApiEndpointImplementedInThisStep=false",
    },
    {
      item: "no_actual_runtime_execution",
      area: "no_run_boundary",
      satisfied: input.source.sourceActualRuntimeExecutionAllowedInThisStep === false,
      detail: "actualRuntimeExecutionAllowedInThisStep=false",
    },
    {
      item: "no_actual_execution_runner",
      area: "no_run_boundary",
      satisfied: input.source.sourceActualExecutionRunnerAllowedInThisStep === false,
      detail: "actualExecutionRunnerAllowedInThisStep=false",
    },
    {
      item: "no_actual_persistence",
      area: "persistence_boundary",
      satisfied: input.source.sourceActualPersistenceAllowedInThisStep === false,
      detail: "actualPersistenceAllowedInThisStep=false",
    },
    {
      item: "no_actual_schema_migration",
      area: "persistence_boundary",
      satisfied: input.source.sourceActualSchemaMigrationAllowedInThisStep === false,
      detail: "actualSchemaMigrationAllowedInThisStep=false",
    },
    {
      item: "no_cursor_github_wire",
      area: "security_contract",
      satisfied: input.source.sourceActualCursorGithubWireAllowedInThisStep === false,
      detail: "actualCursorGithubWireAllowedInThisStep=false",
    },
    {
      item: "no_connector_routing_change",
      area: "security_contract",
      satisfied: input.source.sourceActualConnectorRoutingChangeAllowedInThisStep === false,
      detail: "actualConnectorRoutingChangeAllowedInThisStep=false",
    },
    {
      item: "no_ui_implementation",
      area: "separated_work",
      satisfied: true,
      detail: "actualUiImplementationAllowedInThisStep=false",
    },
  ]);

  const approvalChecklist = mapChecklist([
    {
      item: "runtime_api_contract_reviewed",
      area: "approval_contract",
      satisfied: input.parsed.runtimeApiContractReviewed,
      detail: "runtimeApiContractReviewed",
    },
    {
      item: "no_endpoint_implementation_confirmed",
      area: "api_contract",
      satisfied: input.parsed.runtimeApiNoEndpointImplementationConfirmed,
      detail: "runtimeApiNoEndpointImplementationConfirmed",
    },
    {
      item: "no_persistence_confirmed",
      area: "persistence_boundary",
      satisfied: input.parsed.runtimeApiNoPersistenceConfirmed,
      detail: "runtimeApiNoPersistenceConfirmed",
    },
    {
      item: "security_boundary_reviewed",
      area: "security_contract",
      satisfied: input.parsed.runtimeApiSecurityBoundaryReviewed,
      detail: "runtimeApiSecurityBoundaryReviewed",
    },
    {
      item: "approval_boundary_reviewed",
      area: "approval_contract",
      satisfied: input.parsed.runtimeApiApprovalBoundaryReviewed,
      detail: "runtimeApiApprovalBoundaryReviewed",
    },
  ]);

  return { apiChecklist, boundaryChecklist, approvalChecklist };
}
