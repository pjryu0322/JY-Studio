/**
 * Stage 8-A runtime execution vertical slice findings (read-only).
 */

import type {
  RuntimeExecutionVerticalSliceFinding,
  RuntimeExecutionVerticalSliceReport,
} from "@/lib/agents/runtimeExecutionVerticalSliceTypes";

function finding(
  severity: RuntimeExecutionVerticalSliceFinding["severity"],
  code: string,
  message: string,
): RuntimeExecutionVerticalSliceFinding {
  return { severity, code, message };
}

export function appendRuntimeExecutionVerticalSliceFindings(input: {
  readonly findings: RuntimeExecutionVerticalSliceFinding[];
  readonly decision: RuntimeExecutionVerticalSliceReport["decision"];
  readonly sourceStage7Decision: string;
  readonly requestValid: boolean;
  readonly rawValidationValid: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly mockRunnerSuccess: boolean;
  readonly rawActualExecutionRequested: boolean;
  readonly actualExecutionRequestBlocked: boolean;
  readonly chainExecuted: boolean;
  readonly chainSkippedReason: string;
}): void {
  const {
    findings,
    decision,
    sourceStage7Decision,
    requestValid,
    rawValidationValid,
    confirmationsSatisfied,
    mockRunnerSuccess,
    rawActualExecutionRequested,
    actualExecutionRequestBlocked,
    chainExecuted,
    chainSkippedReason,
  } = input;

  findings.push(
    finding("info", "stage8_vertical_slice_created", "Stage 8-A runtime execution vertical slice evaluator created"),
  );

  if (sourceStage7Decision !== "stage7_runtime_contract_bundle_closed") {
    findings.push(finding("warning", "stage7_contract_bundle_not_closed", "Stage 7-C contract bundle is not closed"));
    findings.push(finding("warning", "stage8_chain_skipped", `Vertical slice chain skipped (${chainSkippedReason})`));
    findings.push(finding("warning", "stage8_confirmation_missing", "Stage 8-A defers until Stage 7-C is closed"));
    return;
  }

  findings.push(finding("info", "stage7_contract_bundle_source_copied", "Stage 7-C bundle closure source copied"));

  if (actualExecutionRequestBlocked) {
    findings.push(
      finding("blocking", "stage8_raw_actual_execution_request_detected", "Raw actualExecutionRequested=true detected"),
    );
    findings.push(
      finding("blocking", "stage8_actual_execution_request_blocked", "Actual execution request blocked in Stage 8-A"),
    );
    findings.push(finding("blocking", "stage8_chain_skipped", `Vertical slice chain skipped (${chainSkippedReason})`));
    findings.push(finding("blocking", "stage8_vertical_slice_blocked", "Stage 8-A vertical slice is blocked"));
    return;
  }

  if (!requestValid || !rawValidationValid) {
    findings.push(finding("blocking", "stage8_request_input_invalid", "Runtime execution request input is invalid"));
    findings.push(finding("info", "stage8_request_normalization_guarded", "Normalized request remains design-only guarded"));
    findings.push(finding("blocking", "stage8_request_invalid", "Runtime execution request is invalid"));
    findings.push(finding("blocking", "stage8_chain_skipped", `Vertical slice chain skipped (${chainSkippedReason})`));
    findings.push(finding("blocking", "stage8_vertical_slice_blocked", "Stage 8-A vertical slice is blocked"));
    return;
  }

  if (!chainExecuted) {
    findings.push(finding("blocking", "stage8_chain_skipped", `Vertical slice chain skipped (${chainSkippedReason})`));
    findings.push(finding("blocking", "stage8_vertical_slice_blocked", "Stage 8-A vertical slice is blocked"));
    return;
  }

  findings.push(finding("info", "stage8_chain_executed", "Vertical slice chain executed in memory"));

  if (!confirmationsSatisfied) {
    findings.push(finding("warning", "stage8_confirmation_missing", "Stage 8-A confirmations are incomplete"));
    return;
  }

  if (!mockRunnerSuccess) {
    findings.push(finding("blocking", "stage8_mock_runner_failed", "Mock runner did not complete successfully"));
    findings.push(finding("blocking", "stage8_vertical_slice_blocked", "Stage 8-A vertical slice is blocked"));
    return;
  }

  findings.push(finding("info", "stage8_in_memory_record_created", "In-memory runtime execution record created"));
  findings.push(finding("info", "stage8_mock_runner_executed", "Mock runtime runner executed in memory"));
  findings.push(finding("info", "stage8_status_transition_completed", "Dry-run-like status transition completed"));
  findings.push(finding("info", "stage8_audit_events_created", "Runtime execution audit events created"));
  findings.push(finding("info", "stage8_no_external_side_effect_verified", "No external side effect verified"));
  findings.push(finding("info", "stage8_no_db_write_verified", "No DB write verified"));
  findings.push(finding("info", "stage8_no_cursor_github_call_verified", "No Cursor/GitHub call verified"));
  findings.push(finding("info", "stage8_no_api_route_handler_verified", "No API route handler verified"));

  if (decision === "stage8_minimal_vertical_slice_ready") {
    findings.push(finding("info", "stage8_minimal_vertical_slice_ready", "Stage 8-A minimal vertical slice is ready"));
  }
}
