/**
 * Stage 12-A manual dry-run gate findings (read-only).
 */

import type {
  ExternalExecutionManualDryRunGateDecision,
  ExternalExecutionManualDryRunGateFinding,
  ExternalExecutionManualDryRunGateValidationResult,
} from "@/lib/agents/externalExecutionManualDryRunGateTypes";
import type { ExternalExecutionDryRunPackageReport } from "@/lib/agents/externalExecutionDryRunPackageTypes";

function finding(
  severity: ExternalExecutionManualDryRunGateFinding["severity"],
  code: string,
  message: string,
): ExternalExecutionManualDryRunGateFinding {
  return { severity, code, message };
}

export function appendExternalExecutionManualDryRunGateFindings(input: {
  readonly findings: ExternalExecutionManualDryRunGateFinding[];
  readonly decision: ExternalExecutionManualDryRunGateDecision;
  readonly source: ExternalExecutionDryRunPackageReport;
  readonly validation: ExternalExecutionManualDryRunGateValidationResult;
  readonly confirmationsSatisfied: boolean;
  readonly stage13EntryReady: boolean;
}): void {
  const { findings, decision, source, validation, confirmationsSatisfied, stage13EntryReady } = input;

  findings.push(
    finding("info", "external_execution_manual_dry_run_gate_evaluator_created", "Stage 12-A manual dry-run gate evaluator created"),
  );

  if (source.decision === "blocked") {
    findings.push(
      finding("blocking", "stage11_external_execution_dry_run_package_not_ready", "Source Stage 11-A dry-run package is blocked"),
    );
    findings.push(finding("blocking", "stage12_external_execution_manual_dry_run_gate_blocked", "Stage 12-A manual gate is blocked"));
    return;
  }

  if (source.decision === "defer" || source.decision !== "stage11_external_execution_dry_run_package_ready") {
    findings.push(
      finding("warning", "stage11_external_execution_dry_run_package_not_ready", "Source Stage 11-A dry-run package is not ready"),
    );
    if (!confirmationsSatisfied) {
      findings.push(finding("warning", "stage13_entry_deferred", "Stage 13 entry defers until confirmations are complete"));
    }
    findings.push(finding("warning", "stage12_external_execution_manual_dry_run_gate_deferred", "Stage 12-A manual gate defers"));
    return;
  }

  findings.push(
    finding("info", "stage11_external_execution_dry_run_package_source_copied", "Stage 11-A dry-run package source copied"),
  );

  if (!validation.valid || source.stage12EntryReady !== true) {
    findings.push(finding("blocking", "stage12_manual_dry_run_gate_validation_failed", "Manual dry-run gate validation failed"));
    findings.push(finding("blocking", "stage12_external_execution_manual_dry_run_gate_blocked", "Stage 12-A manual gate is blocked"));
    return;
  }

  if (!stage13EntryReady || !confirmationsSatisfied) {
    if (!stage13EntryReady) {
      findings.push(finding("warning", "stage13_entry_deferred", "Stage 13 entry candidate is not ready"));
    }
    findings.push(finding("warning", "stage12_external_execution_manual_dry_run_gate_deferred", "Stage 12-A manual gate defers"));
    return;
  }

  findings.push(finding("info", "manual_dry_run_gate_defined", "Manual dry-run gate defined"));
  findings.push(finding("info", "operator_approved_invocation_request_defined", "Operator-approved invocation request defined"));
  findings.push(finding("info", "mock_external_adapter_result_package_defined", "Mock external adapter result package defined"));
  findings.push(finding("info", "dry_run_audit_event_package_defined", "Dry-run audit event package defined"));
  findings.push(finding("info", "rollback_review_before_actual_execution_defined", "Rollback review before actual execution defined"));
  findings.push(finding("info", "no_side_effect_manual_gate_boundary_verified", "No side-effect manual gate boundary verified"));
  findings.push(finding("info", "agent_registry_change_boundary_separated", "Agent registry change boundary separated"));
  findings.push(finding("info", "stage13_entry_candidate_defined", "Stage 13 entry candidate defined"));
  findings.push(finding("info", "actual_external_invocation_disallowed", "Actual external invocation disallowed"));
  findings.push(finding("info", "actual_adapter_side_effect_disallowed", "Actual adapter side-effect disallowed"));
  findings.push(finding("info", "actual_cursor_execution_disallowed", "Actual Cursor execution disallowed"));
  findings.push(finding("info", "actual_github_write_disallowed", "Actual GitHub write disallowed"));
  findings.push(finding("info", "actual_connector_gateway_call_disallowed", "Actual Connector Gateway call disallowed"));
  findings.push(finding("info", "actual_db_persistence_disallowed", "Actual DB persistence disallowed"));
  findings.push(finding("info", "actual_production_runner_disallowed", "Actual production runner disallowed"));
  findings.push(finding("info", "actual_agent_registry_mutation_disallowed", "Actual agent registry mutation disallowed"));

  if (decision === "stage12_external_execution_manual_dry_run_gate_ready") {
    findings.push(
      finding(
        "info",
        "stage12_external_execution_manual_dry_run_gate_ready",
        "Stage 12 external execution manual dry-run gate is ready",
      ),
    );
  }
}
