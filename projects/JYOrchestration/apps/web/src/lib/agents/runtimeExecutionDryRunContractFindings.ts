/**
 * Stage 6-E dry-run contract findings builder (read-only).
 */

import type { RuntimeExecutionContractCandidateReport } from "@/lib/agents/runtimeExecutionContractCandidateTypes";
import type {
  ParsedRuntimeExecutionDryRunContractInput,
  RuntimeExecutionDryRunContractDecision,
  RuntimeExecutionDryRunContractFinding,
} from "@/lib/agents/runtimeExecutionDryRunContractTypes";

function finding(
  severity: RuntimeExecutionDryRunContractFinding["severity"],
  code: string,
  message: string,
): RuntimeExecutionDryRunContractFinding {
  return { severity, code, message };
}

export function appendRuntimeExecutionDryRunContractFindings(input: {
  readonly findings: RuntimeExecutionDryRunContractFinding[];
  readonly decision: RuntimeExecutionDryRunContractDecision;
  readonly source: RuntimeExecutionContractCandidateReport;
  readonly parsed: ParsedRuntimeExecutionDryRunContractInput;
  readonly dryRunContractItemsValid: boolean;
}): void {
  const { findings, decision, source, parsed, dryRunContractItemsValid } = input;

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

  if (source.contractCandidateOnly !== true) {
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

  if (!dryRunContractItemsValid) {
    findings.push(
      finding("blocking", "dry_run_contract_item_validation_failed", "Dry-run contract items failed validation"),
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
