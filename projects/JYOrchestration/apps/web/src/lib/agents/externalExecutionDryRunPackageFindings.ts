/**
 * Stage 11-A external execution dry-run package findings (read-only).
 */

import type {
  ExternalExecutionDryRunPackageDecision,
  ExternalExecutionDryRunPackageFinding,
  ExternalExecutionDryRunPackageValidationResult,
} from "@/lib/agents/externalExecutionDryRunPackageTypes";
import type { ExternalExecutionAdapterBoundaryReport } from "@/lib/agents/externalExecutionAdapterBoundaryTypes";

function finding(
  severity: ExternalExecutionDryRunPackageFinding["severity"],
  code: string,
  message: string,
): ExternalExecutionDryRunPackageFinding {
  return { severity, code, message };
}

export function appendExternalExecutionDryRunPackageFindings(input: {
  readonly findings: ExternalExecutionDryRunPackageFinding[];
  readonly decision: ExternalExecutionDryRunPackageDecision;
  readonly source: ExternalExecutionAdapterBoundaryReport;
  readonly validation: ExternalExecutionDryRunPackageValidationResult;
  readonly confirmationsSatisfied: boolean;
  readonly stage12EntryReady: boolean;
}): void {
  const { findings, decision, source, validation, confirmationsSatisfied, stage12EntryReady } = input;

  findings.push(
    finding("info", "external_execution_dry_run_package_evaluator_created", "Stage 11-A dry-run package evaluator created"),
  );

  if (source.decision === "blocked") {
    findings.push(
      finding("blocking", "stage10_external_execution_adapter_boundary_not_ready", "Source Stage 10-A boundary is blocked"),
    );
    findings.push(finding("blocking", "stage11_external_execution_dry_run_package_blocked", "Stage 11-A dry-run package is blocked"));
    return;
  }

  if (source.decision === "defer" || source.decision !== "stage10_external_execution_adapter_boundary_ready") {
    findings.push(
      finding("warning", "stage10_external_execution_adapter_boundary_not_ready", "Source Stage 10-A boundary is not ready"),
    );
    if (!confirmationsSatisfied) {
      findings.push(finding("warning", "stage12_entry_deferred", "Stage 12 entry defers until confirmations are complete"));
    }
    findings.push(finding("warning", "stage11_external_execution_dry_run_package_deferred", "Stage 11-A dry-run package defers"));
    return;
  }

  findings.push(
    finding("info", "stage10_external_execution_adapter_boundary_source_copied", "Stage 10-A boundary source copied"),
  );

  if (!validation.valid || source.stage11EntryReady !== true) {
    findings.push(finding("blocking", "stage11_dry_run_package_validation_failed", "Dry-run package validation failed"));
    findings.push(finding("blocking", "stage11_external_execution_dry_run_package_blocked", "Stage 11-A dry-run package is blocked"));
    return;
  }

  if (!stage12EntryReady || !confirmationsSatisfied) {
    if (!stage12EntryReady) {
      findings.push(finding("warning", "stage12_entry_deferred", "Stage 12 entry candidate is not ready"));
    }
    findings.push(finding("warning", "stage11_external_execution_dry_run_package_deferred", "Stage 11-A dry-run package defers"));
    return;
  }

  findings.push(finding("info", "external_execution_dry_run_package_created", "External execution dry-run package created"));
  findings.push(finding("info", "cursor_github_dry_run_contract_defined", "Cursor/GitHub dry-run contract defined"));
  findings.push(finding("info", "connector_gateway_dry_run_contract_defined", "Connector gateway dry-run contract defined"));
  findings.push(finding("info", "runner_process_dry_run_contract_defined", "Runner process dry-run contract defined"));
  findings.push(finding("info", "operator_approval_before_dry_run_defined", "Operator approval before dry-run defined"));
  findings.push(finding("info", "rollback_plan_before_external_execution_defined", "Rollback plan before external execution defined"));
  findings.push(finding("info", "audit_event_before_external_execution_defined", "Audit event before external execution defined"));
  findings.push(finding("info", "no_side_effect_boundary_verified", "No side-effect boundary verified"));
  findings.push(finding("info", "agent_registry_change_boundary_separated", "Agent registry change boundary separated"));
  findings.push(finding("info", "agent_add_remove_deactivate_out_of_scope", "Agent add/remove/deactivate out of scope"));
  findings.push(finding("info", "stage12_entry_candidate_defined", "Stage 12 entry candidate defined"));
  findings.push(finding("info", "actual_cursor_execution_disallowed", "Actual Cursor execution disallowed"));
  findings.push(finding("info", "actual_github_write_disallowed", "Actual GitHub write disallowed"));
  findings.push(finding("info", "actual_connector_gateway_call_disallowed", "Actual Connector Gateway call disallowed"));
  findings.push(finding("info", "actual_db_persistence_disallowed", "Actual DB persistence disallowed"));
  findings.push(finding("info", "actual_production_runner_disallowed", "Actual production runner disallowed"));

  if (decision === "stage11_external_execution_dry_run_package_ready") {
    findings.push(
      finding(
        "info",
        "stage11_external_execution_dry_run_package_ready",
        "Stage 11 external execution dry-run package is ready",
      ),
    );
  }
}
