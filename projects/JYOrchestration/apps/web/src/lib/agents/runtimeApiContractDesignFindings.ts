/**
 * Stage 7-B runtime API contract design findings builder (read-only).
 */

import type { RuntimeImplementationPlanningCandidateReport } from "@/lib/agents/runtimeImplementationPlanningCandidateTypes";
import type {
  ParsedRuntimeApiContractDesignInput,
  RuntimeApiContractDesignDecision,
  RuntimeApiContractDesignFinding,
  RuntimeApiEndpointContractValidationResult,
} from "@/lib/agents/runtimeApiContractDesignTypes";

function finding(
  severity: RuntimeApiContractDesignFinding["severity"],
  code: string,
  message: string,
): RuntimeApiContractDesignFinding {
  return { severity, code, message };
}

export function appendRuntimeApiContractDesignFindings(input: {
  readonly findings: RuntimeApiContractDesignFinding[];
  readonly decision: RuntimeApiContractDesignDecision;
  readonly source: RuntimeImplementationPlanningCandidateReport;
  readonly parsed: ParsedRuntimeApiContractDesignInput;
  readonly endpointValidation: RuntimeApiEndpointContractValidationResult;
}): void {
  const { findings, decision, source, parsed, endpointValidation } = input;

  findings.push(finding("info", "runtime_api_contract_design_created", "Stage 7-B API contract design evaluator created"));
  findings.push(
    finding("info", "runtime_api_contract_design_only", "Stage 7-B remains contract design only; no API endpoint implementation"),
  );

  if (source.decision === "blocked") {
    findings.push(finding("blocking", "source_planning_candidate_blocked", "Source Stage 7-A planning candidate is blocked"));
    findings.push(finding("blocking", "stage7_b_api_contract_design_blocked", "Stage 7-B API contract design is blocked"));
    return;
  }

  if (source.decision === "defer" || source.decision !== "ready_for_runtime_implementation_pr_planning") {
    findings.push(finding("warning", "source_planning_candidate_not_ready", "Source Stage 7-A planning candidate is not ready"));
    if (!parsed.runtimeApiContractReviewed) {
      findings.push(finding("warning", "stage7_b_api_contract_design_deferred", "runtimeApiContractReviewed is missing"));
    }
    if (!parsed.runtimeApiNoEndpointImplementationConfirmed) {
      findings.push(finding("warning", "stage7_b_api_contract_design_deferred", "runtimeApiNoEndpointImplementationConfirmed is missing"));
    }
    if (!parsed.runtimeApiNoPersistenceConfirmed) {
      findings.push(finding("warning", "stage7_b_api_contract_design_deferred", "runtimeApiNoPersistenceConfirmed is missing"));
    }
    if (!parsed.runtimeApiSecurityBoundaryReviewed) {
      findings.push(finding("warning", "stage7_b_api_contract_design_deferred", "runtimeApiSecurityBoundaryReviewed is missing"));
    }
    if (!parsed.runtimeApiApprovalBoundaryReviewed) {
      findings.push(finding("warning", "stage7_b_api_contract_design_deferred", "runtimeApiApprovalBoundaryReviewed is missing"));
    }
    findings.push(finding("warning", "stage7_b_api_contract_design_deferred", "Stage 7-B API contract design defers"));
    return;
  }

  if (
    source.planningCandidateOnly !== true ||
    source.planningItemCount < 10 ||
    source.sourceActualRuntimeExecutionAllowedInThisStep !== false ||
    source.sourceActualExecutionRunnerAllowedInThisStep !== false ||
    source.sourceActualPersistenceAllowedInThisStep !== false ||
    source.sourceActualSchemaMigrationAllowedInThisStep !== false ||
    source.sourceActualCursorGithubWireAllowedInThisStep !== false ||
    source.sourceActualConnectorRoutingChangeAllowedInThisStep !== false ||
    !endpointValidation.valid
  ) {
    if (!endpointValidation.valid) {
      findings.push(finding("blocking", "endpoint_contract_validation_failed", "Endpoint contract validation failed"));
    }
    findings.push(finding("blocking", "stage7_b_api_contract_design_blocked", "Stage 7-B API contract design is blocked"));
    return;
  }

  findings.push(finding("info", "source_planning_trace_copied", "Stage 7-A planning trace copied into API contract design report"));
  findings.push(finding("info", "endpoint_contract_validation_passed", "All required endpoint contracts validated"));
  findings.push(finding("info", "api_endpoint_implementation_disallowed", "API endpoint implementation remains disallowed in Stage 7-B"));
  findings.push(finding("info", "runtime_execution_api_implementation_disallowed", "Runtime execution API implementation remains disallowed"));
  findings.push(finding("info", "execution_runner_implementation_disallowed", "Execution runner implementation remains disallowed"));
  findings.push(finding("info", "persistence_implementation_disallowed", "Persistence implementation remains disallowed"));
  findings.push(finding("info", "schema_migration_disallowed", "Schema migration remains disallowed"));
  findings.push(finding("info", "cursor_github_wire_disallowed", "Cursor/GitHub wire remains disallowed"));
  findings.push(finding("info", "connector_routing_change_disallowed", "Connector routing change remains disallowed"));
  findings.push(finding("info", "approval_boundary_required", "Approval boundary is required before implementation"));
  findings.push(finding("info", "security_boundary_required", "Security boundary review is required before implementation"));
  if (decision === "ready_for_execution_runner_contract_design") {
    findings.push(finding("info", "stage7_b_api_contract_design_ready", "Stage 7-B API contract design is ready for execution runner contract design"));
  }
}
