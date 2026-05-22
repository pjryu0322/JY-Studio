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

function endpointValidationPassed(validation: RuntimeApiEndpointContractValidationResult): boolean {
  return (
    validation.invalidMethodEndpointIds.length === 0 &&
    validation.missingStatusTransitionEndpointIds.length === 0 &&
    validation.insufficientStatusTransitionEndpointIds.length === 0 &&
    validation.unsafePathPatternEndpointIds.length === 0 &&
    validation.nonRuntimeApiPathEndpointIds.length === 0 &&
    validation.missingSecurityErrorEndpointIds.length === 0 &&
    validation.missingApprovalErrorEndpointIds.length === 0 &&
    validation.missingAuditCorrelationEndpointIds.length === 0
  );
}

export function appendRuntimeApiContractDesignFindings(input: {
  readonly findings: RuntimeApiContractDesignFinding[];
  readonly decision: RuntimeApiContractDesignDecision;
  readonly source: RuntimeImplementationPlanningCandidateReport;
  readonly parsed: ParsedRuntimeApiContractDesignInput;
  readonly endpointValidation: RuntimeApiEndpointContractValidationResult;
  readonly apiContractFingerprint: string;
}): void {
  const { findings, decision, source, parsed, endpointValidation, apiContractFingerprint } = input;

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
    source.sourceActualDryRunRunnerAllowedInThisStep !== false ||
    source.sourceActualExecutionWireAllowedInThisStep !== false ||
    source.sourceActualPersistenceAllowedInThisStep !== false ||
    source.sourceActualExternalSideEffectAllowedInThisStep !== false ||
    source.sourceActualSchemaMigrationAllowedInThisStep !== false ||
    source.sourceActualCursorGithubWireAllowedInThisStep !== false ||
    source.sourceActualConnectorRoutingChangeAllowedInThisStep !== false ||
    source.actualUiImplementationAllowedInThisStep !== false ||
    !endpointValidation.valid
  ) {
    if (!endpointValidation.valid) {
      findings.push(finding("blocking", "endpoint_contract_validation_failed", "Endpoint contract validation failed"));
    }
    findings.push(finding("blocking", "stage7_b_api_contract_design_blocked", "Stage 7-B API contract design is blocked"));
    return;
  }

  findings.push(finding("info", "source_planning_trace_copied", "Stage 7-A planning trace copied into API contract design report"));
  findings.push(
    finding("info", "source_actual_dry_run_runner_boundary_verified", "Source actual dry-run runner boundary verified as disallowed"),
  );
  findings.push(
    finding("info", "source_actual_execution_wire_boundary_verified", "Source actual execution wire boundary verified as disallowed"),
  );
  findings.push(
    finding("info", "source_actual_external_side_effect_boundary_verified", "Source actual external side-effect boundary verified as disallowed"),
  );
  findings.push(finding("info", "source_actual_ui_boundary_verified", "Source UI implementation boundary verified as disallowed"));
  findings.push(finding("info", "endpoint_contract_validation_passed", "All required endpoint contracts validated"));
  if (endpointValidationPassed(endpointValidation)) {
    findings.push(finding("info", "endpoint_method_validation_passed", "Endpoint method validation passed"));
    findings.push(finding("info", "endpoint_status_transition_validation_passed", "Endpoint status transition validation passed"));
    findings.push(finding("info", "endpoint_path_safety_validation_passed", "Endpoint path safety validation passed"));
    findings.push(finding("info", "endpoint_security_error_validation_passed", "Endpoint security error validation passed"));
    findings.push(finding("info", "endpoint_approval_error_validation_passed", "Endpoint approval error validation passed"));
    findings.push(finding("info", "endpoint_audit_correlation_validation_passed", "Endpoint audit correlation validation passed"));
  }
  findings.push(
    finding("info", "runtime_api_contract_fingerprint_created", `API contract fingerprint created: ${apiContractFingerprint}`),
  );
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
