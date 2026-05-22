/**
 * Stage 6-E dry-run contract findings builder (read-only).
 */

import type { RuntimeExecutionContractCandidateReport } from "@/lib/agents/runtimeExecutionContractCandidateTypes";
import type {
  ParsedRuntimeExecutionDryRunContractInput,
  RuntimeExecutionDryRunContractDecision,
  RuntimeExecutionDryRunContractFinding,
  RuntimeExecutionDryRunContractValidationResult,
} from "@/lib/agents/runtimeExecutionDryRunContractTypes";

function finding(
  severity: RuntimeExecutionDryRunContractFinding["severity"],
  code: string,
  message: string,
): RuntimeExecutionDryRunContractFinding {
  return { severity, code, message };
}

function dryRunValidationFailureMessage(validation: RuntimeExecutionDryRunContractValidationResult): string {
  return [
    validation.missingDryRunContractIds.length > 0
      ? `missing=${validation.missingDryRunContractIds.join(",")}`
      : null,
    validation.duplicateDryRunContractIds.length > 0
      ? `duplicate=${validation.duplicateDryRunContractIds.join(",")}`
      : null,
    validation.emptyRequiredInputContractIds.length > 0
      ? `emptyInputs=${validation.emptyRequiredInputContractIds.join(",")}`
      : null,
    validation.insufficientAssertionContractIds.length > 0
      ? `insufficientAssertions=${validation.insufficientAssertionContractIds.join(",")}`
      : null,
    validation.invalidBoundaryRuleContractIds.length > 0
      ? `invalidRules=${validation.invalidBoundaryRuleContractIds.join(",")}`
      : null,
    validation.implementedInThisStepContractIds.length > 0
      ? `implemented=${validation.implementedInThisStepContractIds.join(",")}`
      : null,
  ]
    .filter((part): part is string => part !== null)
    .join("; ");
}

export function appendRuntimeExecutionDryRunContractFindings(input: {
  readonly findings: RuntimeExecutionDryRunContractFinding[];
  readonly decision: RuntimeExecutionDryRunContractDecision;
  readonly source: RuntimeExecutionContractCandidateReport;
  readonly parsed: ParsedRuntimeExecutionDryRunContractInput;
  readonly dryRunContractValidation: RuntimeExecutionDryRunContractValidationResult;
}): void {
  const { findings, decision, source, parsed, dryRunContractValidation } = input;

  findings.push(
    finding("info", "runtime_execution_dry_run_contract_created", "Stage 6-E dry-run contract evaluator created"),
  );
  findings.push(
    finding("info", "runtime_execution_dry_run_contract_only", "Runtime execution dry-run contract remains design-only"),
  );

  if (source.decision === "blocked") {
    findings.push(finding("blocking", "source_contract_candidate_blocked", "Source Stage 6-D contract candidate is blocked"));
    findings.push(finding("blocking", "stage6_e_dry_run_contract_blocked", "Stage 6-E dry-run contract is blocked"));
    return;
  }

  if (source.forbiddenFieldDetected === true) {
    findings.push(
      finding(
        "blocking",
        "source_contract_candidate_forbidden_field_detected",
        `Forbidden fields detected in contract candidate source`,
      ),
    );
    findings.push(finding("blocking", "stage6_e_dry_run_contract_blocked", "Stage 6-E dry-run contract is blocked"));
    return;
  }

  if (source.actualRuntimeExecutionAllowedInThisStep !== false) {
    findings.push(
      finding(
        "blocking",
        "source_contract_candidate_actual_runtime_boundary_violation",
        "Source actual runtime execution boundary violated",
      ),
    );
    findings.push(finding("blocking", "stage6_e_dry_run_contract_blocked", "Stage 6-E dry-run contract is blocked"));
    return;
  }

  if (source.actualExecutionRunnerAllowedInThisStep !== false) {
    findings.push(
      finding(
        "blocking",
        "source_contract_candidate_actual_runner_boundary_violation",
        "Source actual execution runner boundary violated",
      ),
    );
    findings.push(finding("blocking", "stage6_e_dry_run_contract_blocked", "Stage 6-E dry-run contract is blocked"));
    return;
  }

  if (source.actualExecutionWireAllowedInThisStep !== false) {
    findings.push(
      finding(
        "blocking",
        "source_contract_candidate_actual_wire_boundary_violation",
        "Source actual execution wire boundary violated",
      ),
    );
    findings.push(finding("blocking", "stage6_e_dry_run_contract_blocked", "Stage 6-E dry-run contract is blocked"));
    return;
  }

  if (source.actualPersistenceAllowedInThisStep !== false) {
    findings.push(
      finding(
        "blocking",
        "source_contract_candidate_actual_persistence_boundary_violation",
        "Source actual persistence boundary violated",
      ),
    );
    findings.push(finding("blocking", "stage6_e_dry_run_contract_blocked", "Stage 6-E dry-run contract is blocked"));
    return;
  }

  if (source.actualExternalSideEffectAllowedInThisStep !== false) {
    findings.push(
      finding(
        "blocking",
        "source_contract_candidate_actual_wire_boundary_violation",
        "Source actual external side-effect boundary violated",
      ),
    );
    findings.push(finding("blocking", "stage6_e_dry_run_contract_blocked", "Stage 6-E dry-run contract is blocked"));
    return;
  }

  if (source.actualSchemaMigrationAllowedInThisStep !== false) {
    findings.push(
      finding(
        "blocking",
        "source_contract_candidate_schema_migration_boundary_violation",
        "Source schema migration boundary violated",
      ),
    );
    findings.push(finding("blocking", "stage6_e_dry_run_contract_blocked", "Stage 6-E dry-run contract is blocked"));
    return;
  }

  if (source.actualCursorGithubWireAllowedInThisStep !== false) {
    findings.push(
      finding(
        "blocking",
        "source_contract_candidate_actual_wire_boundary_violation",
        "Source Cursor/GitHub wire boundary violated",
      ),
    );
    findings.push(finding("blocking", "stage6_e_dry_run_contract_blocked", "Stage 6-E dry-run contract is blocked"));
    return;
  }

  if (source.actualConnectorRoutingChangeAllowedInThisStep !== false) {
    findings.push(
      finding(
        "blocking",
        "source_contract_candidate_actual_wire_boundary_violation",
        "Source connector routing change boundary violated",
      ),
    );
    findings.push(finding("blocking", "stage6_e_dry_run_contract_blocked", "Stage 6-E dry-run contract is blocked"));
    return;
  }

  if (source.contractCandidateValidation.valid !== true) {
    findings.push(
      finding("blocking", "source_contract_candidate_validation_failed", "Source contract candidate validation failed"),
    );
    findings.push(finding("blocking", "stage6_e_dry_run_contract_blocked", "Stage 6-E dry-run contract is blocked"));
    return;
  }

  if (source.sourceReviewGateOnly !== true || source.sourceCandidateOnly !== true || source.contractCandidateOnly !== true) {
    findings.push(
      finding("blocking", "source_contract_candidate_boundary_violation", "Source contract candidate boundary violation"),
    );
    findings.push(finding("blocking", "stage6_e_dry_run_contract_blocked", "Stage 6-E dry-run contract is blocked"));
    return;
  }

  if (source.sourceNoRunBoundarySatisfied !== true) {
    findings.push(
      finding("blocking", "source_contract_candidate_boundary_violation", "Source no-run boundary not satisfied"),
    );
    findings.push(finding("blocking", "stage6_e_dry_run_contract_blocked", "Stage 6-E dry-run contract is blocked"));
    return;
  }

  if (source.sourcePersistenceBoundarySatisfied !== true) {
    findings.push(
      finding("blocking", "source_contract_candidate_boundary_violation", "Source persistence boundary not satisfied"),
    );
    findings.push(finding("blocking", "stage6_e_dry_run_contract_blocked", "Stage 6-E dry-run contract is blocked"));
    return;
  }

  if (source.sourceSchemaMigrationBoundarySatisfied !== true) {
    findings.push(
      finding("blocking", "source_contract_candidate_boundary_violation", "Source schema migration boundary not satisfied"),
    );
    findings.push(finding("blocking", "stage6_e_dry_run_contract_blocked", "Stage 6-E dry-run contract is blocked"));
    return;
  }

  if (!dryRunContractValidation.valid) {
    findings.push(
      finding(
        "blocking",
        "dry_run_contract_validation_failed",
        dryRunValidationFailureMessage(dryRunContractValidation),
      ),
    );
    findings.push(finding("blocking", "stage6_e_dry_run_contract_blocked", "Stage 6-E dry-run contract is blocked"));
    return;
  }

  if (decision === "defer") {
    if (
      source.decision === "defer" ||
      source.decision !== "ready_for_runtime_execution_dry_run_contract"
    ) {
      findings.push(
        finding("warning", "source_contract_candidate_not_ready", "Source Stage 6-D contract candidate is not ready"),
      );
    }
    if (!parsed.runtimeExecutionDryRunContractConfirmed) {
      findings.push(
        finding("warning", "dry_run_contract_confirmation_missing", "runtimeExecutionDryRunContractConfirmed is missing"),
      );
    }
    if (!parsed.runtimeExecutionDryRunBoundaryReviewed) {
      findings.push(
        finding("warning", "dry_run_contract_confirmation_missing", "runtimeExecutionDryRunBoundaryReviewed is missing"),
      );
    }
    if (!parsed.runtimeExecutionDryRunNoRunnerConfirmed) {
      findings.push(
        finding("warning", "dry_run_contract_confirmation_missing", "runtimeExecutionDryRunNoRunnerConfirmed is missing"),
      );
    }
    if (!parsed.runtimeExecutionDryRunPersistenceReviewed) {
      findings.push(
        finding("warning", "dry_run_contract_confirmation_missing", "runtimeExecutionDryRunPersistenceReviewed is missing"),
      );
    }
    if (!parsed.runtimeExecutionDryRunRollbackReviewed) {
      findings.push(
        finding("warning", "dry_run_contract_confirmation_missing", "runtimeExecutionDryRunRollbackReviewed is missing"),
      );
    }
    findings.push(finding("warning", "stage6_e_dry_run_contract_deferred", "Stage 6-E dry-run contract defers"));
    return;
  }

  findings.push(
    finding("info", "source_contract_candidate_trace_copied", "Stage 6-D contract candidate trace copied into dry-run report"),
  );
  findings.push(
    finding("info", "source_contract_candidate_validation_passed", "Source contract candidate validation passed"),
  );
  findings.push(finding("info", "dry_run_contract_validation_passed", "Dry-run contract item validation passed"));
  findings.push(finding("info", "dry_run_runner_not_implemented", "Actual dry-run runner is not implemented in this step"));
  findings.push(
    finding("info", "dry_run_persistence_not_implemented", "Dry-run persistence is not implemented in this step"),
  );
  findings.push(
    finding("info", "dry_run_schema_migration_disallowed", "Schema migration remains disallowed in dry-run contract step"),
  );
  findings.push(
    finding("info", "runtime_execution_contract_closure_ready", "Ready for runtime execution contract closure"),
  );
}
