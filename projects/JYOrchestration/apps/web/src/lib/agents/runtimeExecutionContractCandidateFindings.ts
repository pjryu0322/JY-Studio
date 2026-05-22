/**
 * Stage 6-D contract candidate findings builder (read-only).
 */

import type { RuntimeExecutionModelReviewGateReport } from "@/lib/agents/runtimeExecutionModelReviewGateTypes";
import type {
  ParsedRuntimeExecutionContractCandidateInput,
  RuntimeExecutionContractCandidateDecision,
  RuntimeExecutionContractCandidateFinding,
} from "@/lib/agents/runtimeExecutionContractCandidateTypes";

function finding(
  severity: RuntimeExecutionContractCandidateFinding["severity"],
  code: string,
  message: string,
): RuntimeExecutionContractCandidateFinding {
  return { severity, code, message };
}

export function appendRuntimeExecutionContractCandidateFindings(input: {
  readonly findings: RuntimeExecutionContractCandidateFinding[];
  readonly decision: RuntimeExecutionContractCandidateDecision;
  readonly source: RuntimeExecutionModelReviewGateReport;
  readonly parsed: ParsedRuntimeExecutionContractCandidateInput;
  readonly contractCandidatesValid: boolean;
}): void {
  const { findings, decision, source, parsed, contractCandidatesValid } = input;

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

  if (!contractCandidatesValid) {
    findings.push(finding("blocking", "runtime_contract_candidate_invalid", "Runtime contract candidates are invalid"));
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
