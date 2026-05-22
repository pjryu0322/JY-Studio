/**
 * Stage 9-B runtime MVP closure findings (read-only).
 */

import type {
  RuntimeExecutionMvpClosureDecision,
  RuntimeExecutionMvpClosureFinding,
  RuntimeExecutionMvpClosureValidationResult,
} from "@/lib/agents/runtimeExecutionMvpClosureTypes";
import type { RuntimeExecutionApiMvpReport } from "@/lib/agents/runtimeExecutionApiMvpTypes";

function finding(
  severity: RuntimeExecutionMvpClosureFinding["severity"],
  code: string,
  message: string,
): RuntimeExecutionMvpClosureFinding {
  return { severity, code, message };
}

export function appendRuntimeExecutionMvpClosureFindings(input: {
  readonly findings: RuntimeExecutionMvpClosureFinding[];
  readonly decision: RuntimeExecutionMvpClosureDecision;
  readonly source: RuntimeExecutionApiMvpReport;
  readonly validation: RuntimeExecutionMvpClosureValidationResult;
  readonly confirmationsSatisfied: boolean;
  readonly stage10EntryReady: boolean;
}): void {
  const { findings, decision, source, validation, confirmationsSatisfied, stage10EntryReady } = input;

  findings.push(
    finding("info", "runtime_mvp_closure_bundle_created", "Stage 9-B runtime MVP closure bundle evaluator created"),
  );

  if (source.decision === "blocked") {
    findings.push(finding("blocking", "stage9_api_mvp_not_ready", "Source Stage 9-A API MVP is blocked"));
    findings.push(finding("blocking", "stage9_mvp_closure_blocked", "Stage 9-B MVP closure bundle is blocked"));
    return;
  }

  if (source.decision === "defer" || source.decision !== "stage9_runtime_execution_api_mvp_ready") {
    findings.push(finding("warning", "stage9_api_mvp_not_ready", "Source Stage 9-A API MVP is not ready"));
    if (!confirmationsSatisfied) {
      findings.push(finding("warning", "stage10_entry_deferred", "Stage 10 entry defers until confirmations are complete"));
    }
    findings.push(finding("warning", "stage9_mvp_closure_deferred", "Stage 9-B MVP closure defers"));
    return;
  }

  findings.push(finding("info", "stage9_runtime_api_mvp_source_copied", "Stage 9-A API MVP source copied"));

  if (
    !validation.valid ||
    !source.stage9AClosureReady ||
    source.actualApiRouteImplementedInThisStep !== true ||
    source.inMemoryStoreImplementedInThisStep !== true ||
    source.mockRunnerAdapterImplementedInThisStep !== true
  ) {
    findings.push(finding("blocking", "stage9_mvp_closure_validation_failed", "MVP closure validation failed"));
    findings.push(finding("blocking", "stage9_mvp_closure_blocked", "Stage 9-B MVP closure bundle is blocked"));
    return;
  }

  if (!stage10EntryReady || !confirmationsSatisfied) {
    if (!stage10EntryReady) {
      findings.push(finding("warning", "stage10_entry_deferred", "Stage 10 entry candidate is not ready"));
    }
    findings.push(finding("warning", "stage9_mvp_closure_deferred", "Stage 9-B MVP closure defers"));
    return;
  }

  findings.push(finding("info", "runtime_api_route_mvp_closed", "Runtime API route MVP closed"));
  findings.push(finding("info", "in_memory_store_lifecycle_closed", "In-memory store lifecycle closed"));
  findings.push(finding("info", "approval_action_closed", "Approval action closed"));
  findings.push(finding("info", "mock_runner_adapter_closed", "Mock runner adapter closed"));
  findings.push(finding("info", "status_query_closed", "Status query closed"));
  findings.push(finding("info", "audit_query_closed", "Audit query closed"));
  findings.push(finding("info", "no_run_boundary_verified", "No-run boundary verified"));
  findings.push(finding("info", "stage10_entry_candidate_defined", "Stage 10 entry candidate defined"));
  findings.push(finding("info", "stage10_separate_approval_required", "Stage 10 entry requires separate approval"));
  findings.push(finding("info", "stage10_implementation_disallowed", "Stage 10 implementation disallowed in this step"));
  findings.push(finding("info", "stage9_source_route_handlers_verified", "Source route handler count verified"));
  findings.push(finding("info", "stage9_source_service_actions_verified", "Source service action count verified"));
  findings.push(finding("info", "stage9_source_boundary_response_verified", "Source boundary response verified"));
  findings.push(finding("info", "stage10_adapter_boundary_design_allowed", "Stage 10 adapter boundary design allowed"));
  findings.push(
    finding("info", "stage10_cursor_github_boundary_design_allowed", "Stage 10 Cursor/GitHub boundary design allowed"),
  );
  findings.push(finding("info", "stage10_connector_boundary_design_allowed", "Stage 10 connector boundary design allowed"));
  findings.push(finding("info", "stage10_runner_boundary_design_allowed", "Stage 10 runner boundary design allowed"));
  findings.push(finding("info", "stage10_dry_run_simulation_design_allowed", "Stage 10 dry-run simulation design allowed"));
  findings.push(finding("info", "stage10_rollback_boundary_design_allowed", "Stage 10 rollback boundary design allowed"));
  findings.push(finding("info", "stage10_actual_execution_disallowed", "Stage 10 actual execution disallowed"));

  if (decision === "stage9_runtime_api_mvp_closed") {
    findings.push(finding("info", "stage9_runtime_api_mvp_closed", "Stage 9 runtime API MVP is closed"));
  }
}
