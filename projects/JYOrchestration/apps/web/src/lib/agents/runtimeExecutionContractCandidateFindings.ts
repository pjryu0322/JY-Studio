/**
 * Stage 6-D contract candidate findings builder (read-only).
 */

import type { RuntimeExecutionModelReviewGateReport } from "@/lib/agents/runtimeExecutionModelReviewGateTypes";
import type {
  ParsedRuntimeExecutionContractCandidateInput,
  RuntimeExecutionContractCandidateDecision,
  RuntimeExecutionContractCandidateFinding,
  RuntimeExecutionContractCandidateValidationResult,
} from "@/lib/agents/runtimeExecutionContractCandidateTypes";

function finding(
  severity: RuntimeExecutionContractCandidateFinding["severity"],
  code: string,
  message: string,
): RuntimeExecutionContractCandidateFinding {
  return { severity, code, message };
}

function validationFailureMessage(validation: RuntimeExecutionContractCandidateValidationResult): string {
  return [
    validation.missingContractIds.length > 0
      ? `missing=${validation.missingContractIds.join(",")}`
      : null,
    validation.duplicateContractIds.length > 0
      ? `duplicate=${validation.duplicateContractIds.join(",")}`
      : null,
    validation.emptyRequiredFieldContractIds.length > 0
      ? `emptyFields=${validation.emptyRequiredFieldContractIds.join(",")}`
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

export function appendRuntimeExecutionContractCandidateFindings(input: {
  readonly findings: RuntimeExecutionContractCandidateFinding[];
  readonly decision: RuntimeExecutionContractCandidateDecision;
  readonly source: RuntimeExecutionModelReviewGateReport;
  readonly parsed: ParsedRuntimeExecutionContractCandidateInput;
  readonly contractCandidateValidation: RuntimeExecutionContractCandidateValidationResult;
}): void {
  const { findings, decision, source, parsed, contractCandidateValidation } = input;

  findings.push(
    finding("info", "runtime_execution_contract_candidate_created", "Stage 6-D contract candidate evaluator created"),
  );
  findings.push(
    finding("info", "runtime_execution_contract_candidate_only", "Runtime execution contract remains candidate-only"),
  );

  if (source.decision === "blocked") {
    findings.push(finding("blocking", "source_review_gate_blocked", "Source Stage 6-C review gate is blocked"));
    findings.push(finding("blocking", "stage6_d_contract_candidate_blocked", "Stage 6-D contract candidate is blocked"));
    return;
  }

  if (source.forbiddenFieldDetected === true) {
    findings.push(
      finding(
        "blocking",
        "source_review_gate_forbidden_field_detected",
        `Forbidden fields detected: ${source.forbiddenFieldNames.join(",")}`,
      ),
    );
    findings.push(finding("blocking", "stage6_d_contract_candidate_blocked", "Stage 6-D contract candidate is blocked"));
    return;
  }

  if (source.actualExecutionWireAllowedInThisStep !== false) {
    findings.push(
      finding(
        "blocking",
        "source_review_gate_actual_execution_boundary_violation",
        "Source actual execution wire boundary violated",
      ),
    );
    findings.push(finding("blocking", "stage6_d_contract_candidate_blocked", "Stage 6-D contract candidate is blocked"));
    return;
  }

  if (source.actualPersistenceAllowedInThisStep !== false) {
    findings.push(
      finding(
        "blocking",
        "source_review_gate_actual_persistence_boundary_violation",
        "Source actual persistence boundary violated",
      ),
    );
    findings.push(finding("blocking", "stage6_d_contract_candidate_blocked", "Stage 6-D contract candidate is blocked"));
    return;
  }

  if (source.actualExternalSideEffectAllowedInThisStep !== false) {
    findings.push(
      finding(
        "blocking",
        "source_review_gate_actual_execution_boundary_violation",
        "Source actual external side-effect boundary violated",
      ),
    );
    findings.push(finding("blocking", "stage6_d_contract_candidate_blocked", "Stage 6-D contract candidate is blocked"));
    return;
  }

  if (source.actualSchemaMigrationAllowedInThisStep !== false) {
    findings.push(
      finding(
        "blocking",
        "source_review_gate_schema_migration_boundary_violation",
        "Source schema migration boundary violated",
      ),
    );
    findings.push(finding("blocking", "stage6_d_contract_candidate_blocked", "Stage 6-D contract candidate is blocked"));
    return;
  }

  if (source.reviewGateOnly !== true || source.sourceCandidateOnly !== true) {
    findings.push(
      finding("blocking", "source_review_gate_boundary_violation", "Source review gate boundary violation"),
    );
    findings.push(finding("blocking", "stage6_d_contract_candidate_blocked", "Stage 6-D contract candidate is blocked"));
    return;
  }

  if (source.sourceNoRunBoundarySatisfied !== true) {
    findings.push(
      finding("blocking", "source_review_gate_boundary_violation", "Source no-run boundary not satisfied"),
    );
    findings.push(finding("blocking", "stage6_d_contract_candidate_blocked", "Stage 6-D contract candidate is blocked"));
    return;
  }

  if (source.sourcePersistenceBoundarySatisfied !== true) {
    findings.push(
      finding("blocking", "source_review_gate_boundary_violation", "Source persistence boundary not satisfied"),
    );
    findings.push(finding("blocking", "stage6_d_contract_candidate_blocked", "Stage 6-D contract candidate is blocked"));
    return;
  }

  if (source.schemaMigrationBoundarySatisfied !== true) {
    findings.push(
      finding("blocking", "source_review_gate_boundary_violation", "Source schema migration boundary not satisfied"),
    );
    findings.push(finding("blocking", "stage6_d_contract_candidate_blocked", "Stage 6-D contract candidate is blocked"));
    return;
  }

  if (!contractCandidateValidation.valid) {
    findings.push(
      finding(
        "blocking",
        "runtime_contract_candidate_validation_failed",
        validationFailureMessage(contractCandidateValidation),
      ),
    );
    findings.push(finding("blocking", "stage6_d_contract_candidate_blocked", "Stage 6-D contract candidate is blocked"));
    return;
  }

  if (decision === "defer") {
    if (source.decision === "defer" || source.decision !== "ready_for_runtime_execution_contract_candidate") {
      findings.push(
        finding("warning", "source_review_gate_not_ready", "Source Stage 6-C review gate is not ready for contract candidate"),
      );
    }
    if (!parsed.runtimeExecutionContractCandidateConfirmed) {
      findings.push(
        finding("warning", "runtime_contract_confirmation_missing", "runtimeExecutionContractCandidateConfirmed is missing"),
      );
    }
    if (!parsed.runtimeExecutionBoundaryContractReviewed) {
      findings.push(
        finding("warning", "runtime_contract_confirmation_missing", "runtimeExecutionBoundaryContractReviewed is missing"),
      );
    }
    if (!parsed.runtimeExecutionDryRunContractReviewed) {
      findings.push(
        finding("warning", "runtime_contract_confirmation_missing", "runtimeExecutionDryRunContractReviewed is missing"),
      );
    }
    if (!parsed.runtimeExecutionRollbackContractReviewed) {
      findings.push(
        finding("warning", "runtime_contract_confirmation_missing", "runtimeExecutionRollbackContractReviewed is missing"),
      );
    }
    if (!parsed.runtimeExecutionApprovalContractReviewed) {
      findings.push(
        finding("warning", "runtime_contract_confirmation_missing", "runtimeExecutionApprovalContractReviewed is missing"),
      );
    }
    findings.push(finding("warning", "stage6_d_contract_candidate_deferred", "Stage 6-D contract candidate defers"));
    return;
  }

  findings.push(
    finding("info", "source_review_gate_trace_copied", "Stage 6-C review gate trace copied into contract candidate report"),
  );
  findings.push(
    finding("info", "runtime_contract_candidate_validation_passed", "Runtime contract candidate validation passed"),
  );
  findings.push(
    finding("info", "runtime_contract_no_run_boundary_enforced", "No-run boundary enforced in contract candidate step"),
  );
  findings.push(
    finding("info", "runtime_contract_schema_boundary_enforced", "Schema migration boundary enforced in contract candidate step"),
  );
  findings.push(
    finding("info", "runtime_contract_persistence_boundary_enforced", "Persistence boundary enforced in contract candidate step"),
  );
  findings.push(
    finding("info", "runtime_execution_dry_run_contract_candidate_ready", "Ready for runtime execution dry-run contract"),
  );
}
