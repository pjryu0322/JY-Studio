/**
 * Stage 7-A implementation planning candidate findings builder (read-only).
 */

import type { RuntimeExecutionContractClosureReport } from "@/lib/agents/runtimeExecutionContractClosureTypes";
import type {
  ParsedRuntimeImplementationPlanningCandidateInput,
  RuntimeImplementationPlanningCandidateDecision,
  RuntimeImplementationPlanningCandidateFinding,
  RuntimeImplementationPlanningValidationResult,
} from "@/lib/agents/runtimeImplementationPlanningCandidateTypes";

function finding(
  severity: RuntimeImplementationPlanningCandidateFinding["severity"],
  code: string,
  message: string,
): RuntimeImplementationPlanningCandidateFinding {
  return { severity, code, message };
}

export function appendRuntimeImplementationPlanningCandidateFindings(input: {
  readonly findings: RuntimeImplementationPlanningCandidateFinding[];
  readonly decision: RuntimeImplementationPlanningCandidateDecision;
  readonly source: RuntimeExecutionContractClosureReport;
  readonly parsed: ParsedRuntimeImplementationPlanningCandidateInput;
  readonly planningValidation: RuntimeImplementationPlanningValidationResult;
}): void {
  const { findings, decision, source, parsed, planningValidation } = input;

  findings.push(
    finding("info", "runtime_implementation_planning_candidate_created", "Stage 7-A planning candidate evaluator created"),
  );
  findings.push(
    finding(
      "info",
      "runtime_implementation_planning_candidate_only",
      "Stage 7-A remains planning-only; no implementation permission",
    ),
  );

  if (source.decision === "blocked") {
    findings.push(finding("blocking", "source_stage6_contract_closure_blocked", "Source Stage 6-F contract closure is blocked"));
    findings.push(finding("blocking", "stage7_a_planning_candidate_blocked", "Stage 7-A planning candidate is blocked"));
    return;
  }

  if (source.decision === "defer" || source.decision !== "stage6_runtime_execution_contract_closed") {
    findings.push(
      finding("warning", "source_stage6_contract_closure_not_ready", "Source Stage 6-F contract closure is not ready"),
    );
    if (!parsed.runtimeImplementationPlanningReviewed) {
      findings.push(finding("warning", "stage7_a_planning_candidate_deferred", "runtimeImplementationPlanningReviewed is missing"));
    }
    if (!parsed.runtimeImplementationSeparatePrConfirmed) {
      findings.push(finding("warning", "stage7_a_planning_candidate_deferred", "runtimeImplementationSeparatePrConfirmed is missing"));
    }
    if (!parsed.runtimeImplementationNoActualExecutionConfirmed) {
      findings.push(finding("warning", "stage7_a_planning_candidate_deferred", "runtimeImplementationNoActualExecutionConfirmed is missing"));
    }
    if (!parsed.runtimeImplementationRollbackPlanReviewed) {
      findings.push(finding("warning", "stage7_a_planning_candidate_deferred", "runtimeImplementationRollbackPlanReviewed is missing"));
    }
    if (!parsed.runtimeImplementationOperatorApprovalRequiredConfirmed) {
      findings.push(
        finding("warning", "stage7_a_planning_candidate_deferred", "runtimeImplementationOperatorApprovalRequiredConfirmed is missing"),
      );
    }
    findings.push(finding("warning", "stage7_a_planning_candidate_deferred", "Stage 7-A planning candidate defers"));
    return;
  }

  if (
    !source.stage6ContractClosed ||
    !source.stage6ClosureOnly ||
    source.actualRuntimeExecutionAllowedAfterStage6 !== false ||
    source.actualRuntimeExecutionAllowedInThisStep !== false ||
    source.actualExecutionRunnerAllowedInThisStep !== false ||
    source.actualDryRunRunnerAllowedInThisStep !== false ||
    source.actualExecutionWireAllowedInThisStep !== false ||
    source.actualPersistenceAllowedInThisStep !== false ||
    source.actualExternalSideEffectAllowedInThisStep !== false ||
    source.actualSchemaMigrationAllowedInThisStep !== false ||
    source.actualCursorGithubWireAllowedInThisStep !== false ||
    source.actualConnectorRoutingChangeAllowedInThisStep !== false ||
    !planningValidation.valid
  ) {
    if (!planningValidation.valid) {
      findings.push(finding("blocking", "planning_items_validation_failed", "Planning items validation failed"));
      if (
        planningValidation.missingDependencyItemIds.length > 0 ||
        planningValidation.unknownDependencyItemIds.length > 0 ||
        planningValidation.selfDependencyItemIds.length > 0
      ) {
        findings.push(finding("blocking", "planning_dependency_validation_failed", "Planning dependency validation failed"));
      }
      if (planningValidation.forbiddenBoundaryCoverageMissingItemIds.length > 0) {
        findings.push(
          finding("blocking", "planning_forbidden_boundary_validation_failed", "Planning forbidden boundary validation failed"),
        );
      }
    }
    findings.push(finding("blocking", "stage7_a_planning_candidate_blocked", "Stage 7-A planning candidate is blocked"));
    return;
  }

  findings.push(finding("info", "source_contract_closure_trace_copied", "Stage 6-F closure trace copied into planning candidate report"));
  findings.push(finding("info", "source_actual_runtime_boundary_verified", "Source actual runtime execution boundary verified as disallowed"));
  findings.push(finding("info", "source_actual_runner_boundary_verified", "Source actual execution runner boundary verified as disallowed"));
  findings.push(finding("info", "source_actual_dry_run_runner_boundary_verified", "Source actual dry-run runner boundary verified as disallowed"));
  findings.push(finding("info", "source_actual_wire_boundary_verified", "Source actual execution wire boundary verified as disallowed"));
  findings.push(finding("info", "source_actual_persistence_boundary_verified", "Source actual persistence boundary verified as disallowed"));
  findings.push(finding("info", "source_actual_schema_boundary_verified", "Source actual schema migration boundary verified as disallowed"));
  findings.push(finding("info", "source_actual_cursor_github_boundary_verified", "Source Cursor/GitHub wire boundary verified as disallowed"));
  findings.push(finding("info", "source_actual_connector_routing_boundary_verified", "Source connector routing boundary verified as disallowed"));
  findings.push(finding("info", "planning_items_validation_passed", "All required planning items validated"));
  findings.push(finding("info", "planning_dependency_validation_passed", "Planning dependency validation passed"));
  findings.push(finding("info", "planning_forbidden_boundary_validation_passed", "Planning forbidden boundary validation passed"));
  findings.push(finding("info", "actual_runtime_execution_still_disallowed", "Actual runtime execution remains disallowed in Stage 7-A"));
  findings.push(finding("info", "actual_runner_still_disallowed", "Actual execution runner remains disallowed in Stage 7-A"));
  findings.push(finding("info", "actual_dry_run_runner_still_disallowed", "Actual dry-run runner remains disallowed in Stage 7-A"));
  findings.push(finding("info", "actual_persistence_still_disallowed", "Actual persistence remains disallowed in Stage 7-A"));
  findings.push(finding("info", "actual_schema_migration_still_disallowed", "Actual schema migration remains disallowed in Stage 7-A"));
  findings.push(finding("info", "separate_pr_planning_required", "Implementation work must be split into separate PRs"));
  findings.push(
    finding("info", "operator_approval_required_before_implementation", "Operator approval is required before any implementation PR"),
  );
  if (decision === "ready_for_runtime_implementation_pr_planning") {
    findings.push(finding("info", "stage7_a_planning_candidate_ready", "Stage 7-A planning candidate is ready for implementation PR planning"));
  }
}
