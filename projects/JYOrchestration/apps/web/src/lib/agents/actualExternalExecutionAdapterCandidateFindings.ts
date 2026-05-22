/**
 * Stage 13-A adapter candidate findings (read-only).
 */

import type {
  ActualExternalExecutionAdapterCandidateDecision,
  ActualExternalExecutionAdapterCandidateFinding,
  ActualExternalExecutionAdapterCandidateValidationResult,
} from "@/lib/agents/actualExternalExecutionAdapterCandidateTypes";
import type { ExternalExecutionManualDryRunGateReport } from "@/lib/agents/externalExecutionManualDryRunGateTypes";

function finding(
  severity: ActualExternalExecutionAdapterCandidateFinding["severity"],
  code: string,
  message: string,
): ActualExternalExecutionAdapterCandidateFinding {
  return { severity, code, message };
}

export function appendActualExternalExecutionAdapterCandidateFindings(input: {
  readonly findings: ActualExternalExecutionAdapterCandidateFinding[];
  readonly decision: ActualExternalExecutionAdapterCandidateDecision;
  readonly source: ExternalExecutionManualDryRunGateReport;
  readonly validation: ActualExternalExecutionAdapterCandidateValidationResult;
  readonly confirmationsSatisfied: boolean;
  readonly stage14EntryReady: boolean;
}): void {
  const { findings, decision, source, validation, confirmationsSatisfied, stage14EntryReady } = input;

  findings.push(
    finding(
      "info",
      "actual_external_execution_adapter_candidate_evaluator_created",
      "Stage 13-A actual external execution adapter candidate evaluator created",
    ),
  );

  if (source.decision === "blocked") {
    findings.push(
      finding("blocking", "stage12_manual_dry_run_gate_not_ready", "Source Stage 12-A manual dry-run gate is blocked"),
    );
    findings.push(
      finding("blocking", "stage13_actual_external_execution_adapter_candidate_blocked", "Stage 13-A adapter candidate is blocked"),
    );
    return;
  }

  if (source.decision === "defer" || source.decision !== "stage12_external_execution_manual_dry_run_gate_ready") {
    findings.push(
      finding("warning", "stage12_manual_dry_run_gate_not_ready", "Source Stage 12-A manual dry-run gate is not ready"),
    );
    if (!confirmationsSatisfied) {
      findings.push(finding("warning", "stage14_entry_deferred", "Stage 14 entry defers until confirmations are complete"));
    }
    findings.push(finding("warning", "stage13_actual_external_execution_adapter_candidate_deferred", "Stage 13-A adapter candidate defers"));
    return;
  }

  findings.push(
    finding("info", "stage12_manual_dry_run_gate_source_copied", "Stage 12-A manual dry-run gate source copied"),
  );

  if (!validation.valid || source.stage13EntryReady !== true) {
    findings.push(
      finding("blocking", "stage13_actual_adapter_candidate_validation_failed", "Actual adapter candidate validation failed"),
    );
    findings.push(
      finding("blocking", "stage13_actual_external_execution_adapter_candidate_blocked", "Stage 13-A adapter candidate is blocked"),
    );
    return;
  }

  if (!stage14EntryReady || !confirmationsSatisfied) {
    if (!stage14EntryReady) {
      findings.push(finding("warning", "stage14_entry_deferred", "Stage 14 entry candidate is not ready"));
    }
    findings.push(finding("warning", "stage13_actual_external_execution_adapter_candidate_deferred", "Stage 13-A adapter candidate defers"));
    return;
  }

  findings.push(
    finding("info", "actual_external_execution_adapter_candidate_boundary_defined", "Actual external execution adapter candidate boundary defined"),
  );
  findings.push(finding("info", "cursor_execution_adapter_candidate_defined", "Cursor execution adapter candidate defined"));
  findings.push(finding("info", "github_write_adapter_candidate_defined", "GitHub write adapter candidate defined"));
  findings.push(finding("info", "connector_gateway_call_adapter_candidate_defined", "Connector gateway call adapter candidate defined"));
  findings.push(finding("info", "runner_process_adapter_candidate_defined", "Runner process adapter candidate defined"));
  findings.push(finding("info", "adapter_permission_contract_defined", "Adapter permission contract defined"));
  findings.push(finding("info", "adapter_result_contract_defined", "Adapter result contract defined"));
  findings.push(finding("info", "adapter_audit_contract_defined", "Adapter audit contract defined"));
  findings.push(finding("info", "adapter_rollback_contract_defined", "Adapter rollback contract defined"));
  findings.push(finding("info", "no_side_effect_candidate_boundary_verified", "No side-effect candidate boundary verified"));
  findings.push(finding("info", "agent_registry_change_boundary_separated", "Agent registry change boundary separated"));
  findings.push(finding("info", "stage14_entry_candidate_defined", "Stage 14 entry candidate defined"));
  findings.push(finding("info", "actual_external_execution_disallowed", "Actual external execution disallowed"));
  findings.push(finding("info", "actual_cursor_adapter_implementation_disallowed", "Actual Cursor adapter implementation disallowed"));
  findings.push(finding("info", "actual_github_adapter_implementation_disallowed", "Actual GitHub adapter implementation disallowed"));
  findings.push(
    finding("info", "actual_connector_adapter_implementation_disallowed", "Actual Connector adapter implementation disallowed"),
  );
  findings.push(finding("info", "actual_runner_adapter_implementation_disallowed", "Actual runner adapter implementation disallowed"));
  findings.push(finding("info", "actual_adapter_credential_usage_disallowed", "Actual adapter credential usage disallowed"));
  findings.push(finding("info", "actual_network_side_effect_disallowed", "Actual network side-effect disallowed"));
  findings.push(finding("info", "actual_db_persistence_disallowed", "Actual DB persistence disallowed"));
  findings.push(finding("info", "actual_ui_implementation_disallowed", "Actual UI implementation disallowed"));
  findings.push(finding("info", "actual_agent_registry_mutation_disallowed", "Actual agent registry mutation disallowed"));

  if (decision === "stage13_actual_external_execution_adapter_candidate_ready") {
    findings.push(
      finding(
        "info",
        "stage13_actual_external_execution_adapter_candidate_ready",
        "Stage 13 actual external execution adapter candidate is ready",
      ),
    );
  }
}
