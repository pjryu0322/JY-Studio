/**
 * Stage 10-A external execution adapter boundary findings (read-only).
 */

import type {
  ExternalExecutionAdapterBoundaryDecision,
  ExternalExecutionAdapterBoundaryFinding,
  ExternalExecutionAdapterBoundaryValidationResult,
} from "@/lib/agents/externalExecutionAdapterBoundaryTypes";
import type { RuntimeExecutionMvpClosureReport } from "@/lib/agents/runtimeExecutionMvpClosureTypes";

function finding(
  severity: ExternalExecutionAdapterBoundaryFinding["severity"],
  code: string,
  message: string,
): ExternalExecutionAdapterBoundaryFinding {
  return { severity, code, message };
}

export function appendExternalExecutionAdapterBoundaryFindings(input: {
  readonly findings: ExternalExecutionAdapterBoundaryFinding[];
  readonly decision: ExternalExecutionAdapterBoundaryDecision;
  readonly source: RuntimeExecutionMvpClosureReport;
  readonly validation: ExternalExecutionAdapterBoundaryValidationResult;
  readonly confirmationsSatisfied: boolean;
  readonly stage11EntryReady: boolean;
}): void {
  const { findings, decision, source, validation, confirmationsSatisfied, stage11EntryReady } = input;

  findings.push(
    finding(
      "info",
      "external_execution_adapter_boundary_evaluator_created",
      "Stage 10-A external execution adapter boundary evaluator created",
    ),
  );

  if (source.decision === "blocked") {
    findings.push(finding("blocking", "stage9_runtime_mvp_closure_not_ready", "Source Stage 9-B closure is blocked"));
    findings.push(
      finding("blocking", "stage10_external_execution_adapter_boundary_blocked", "Stage 10-A boundary is blocked"),
    );
    return;
  }

  if (source.decision === "defer" || source.decision !== "stage9_runtime_api_mvp_closed") {
    findings.push(finding("warning", "stage9_runtime_mvp_closure_not_ready", "Source Stage 9-B closure is not ready"));
    if (!confirmationsSatisfied) {
      findings.push(finding("warning", "stage11_entry_deferred", "Stage 11 entry defers until confirmations are complete"));
    }
    findings.push(finding("warning", "stage10_external_execution_adapter_boundary_deferred", "Stage 10-A boundary defers"));
    return;
  }

  findings.push(finding("info", "stage9_runtime_mvp_closure_source_copied", "Stage 9-B closure source copied"));

  if (!validation.valid || source.stage10EntryReady !== true) {
    findings.push(finding("blocking", "stage10_boundary_validation_failed", "Adapter boundary validation failed"));
    findings.push(
      finding("blocking", "stage10_external_execution_adapter_boundary_blocked", "Stage 10-A boundary is blocked"),
    );
    return;
  }

  if (!stage11EntryReady || !confirmationsSatisfied) {
    if (!stage11EntryReady) {
      findings.push(finding("warning", "stage11_entry_deferred", "Stage 11 entry candidate is not ready"));
    }
    findings.push(finding("warning", "stage10_external_execution_adapter_boundary_deferred", "Stage 10-A boundary defers"));
    return;
  }

  findings.push(finding("info", "external_adapter_contract_defined", "External adapter contract defined"));
  findings.push(finding("info", "cursor_github_boundary_defined", "Cursor/GitHub boundary defined"));
  findings.push(finding("info", "connector_gateway_boundary_defined", "Connector gateway boundary defined"));
  findings.push(finding("info", "runner_process_boundary_defined", "Runner process boundary defined"));
  findings.push(finding("info", "operator_approval_boundary_defined", "Operator approval boundary defined"));
  findings.push(finding("info", "dry_run_simulation_boundary_defined", "Dry-run simulation boundary defined"));
  findings.push(finding("info", "rollback_boundary_defined", "Rollback boundary defined"));
  findings.push(finding("info", "audit_boundary_defined", "Audit boundary defined"));
  findings.push(finding("info", "stage11_entry_candidate_defined", "Stage 11 entry candidate defined"));
  findings.push(finding("info", "actual_cursor_execution_disallowed", "Actual Cursor execution disallowed"));
  findings.push(finding("info", "actual_github_write_disallowed", "Actual GitHub write disallowed"));
  findings.push(finding("info", "actual_connector_gateway_call_disallowed", "Actual Connector Gateway call disallowed"));
  findings.push(finding("info", "actual_db_persistence_disallowed", "Actual DB persistence disallowed"));
  findings.push(finding("info", "actual_production_runner_disallowed", "Actual production runner disallowed"));

  if (decision === "stage10_external_execution_adapter_boundary_ready") {
    findings.push(
      finding(
        "info",
        "stage10_external_execution_adapter_boundary_ready",
        "Stage 10 external execution adapter boundary is ready",
      ),
    );
  }
}
