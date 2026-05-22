/**
 * Stage 8-B runtime control bundle findings (read-only).
 */

import type {
  RuntimeControlBundleDecision,
  RuntimeControlBundleFinding,
  RuntimeControlBundleValidationResult,
} from "@/lib/agents/runtimeControlBundleTypes";
import type { RuntimeExecutionVerticalSliceReport } from "@/lib/agents/runtimeExecutionVerticalSliceTypes";

function finding(
  severity: RuntimeControlBundleFinding["severity"],
  code: string,
  message: string,
): RuntimeControlBundleFinding {
  return { severity, code, message };
}

export function appendRuntimeControlBundleFindings(input: {
  readonly findings: RuntimeControlBundleFinding[];
  readonly decision: RuntimeControlBundleDecision;
  readonly source: RuntimeExecutionVerticalSliceReport;
  readonly validation: RuntimeControlBundleValidationResult;
  readonly confirmationsSatisfied: boolean;
  readonly stage9EntryReady: boolean;
}): void {
  const { findings, decision, source, validation, confirmationsSatisfied, stage9EntryReady } = input;

  findings.push(
    finding("info", "runtime_control_bundle_created", "Stage 8-B runtime control bundle evaluator created"),
  );
  findings.push(finding("info", "runtime_control_bundle_only", "Stage 8-B remains design-only; no implementation permission"),
  );

  if (source.decision === "blocked") {
    findings.push(finding("blocking", "stage8_vertical_slice_not_ready", "Source Stage 8-A vertical slice is blocked"));
    findings.push(finding("blocking", "stage8_control_bundle_blocked", "Stage 8-B control bundle is blocked"));
    return;
  }

  if (source.decision === "defer" || source.decision !== "stage8_minimal_vertical_slice_ready") {
    findings.push(finding("warning", "stage8_vertical_slice_not_ready", "Source Stage 8-A vertical slice is not ready"));
    if (!confirmationsSatisfied) {
      findings.push(finding("warning", "stage9_entry_deferred", "Stage 9 entry defers until confirmations are complete"));
    }
    findings.push(finding("warning", "stage8_control_bundle_deferred", "Stage 8-B control bundle defers"));
    return;
  }

  findings.push(finding("info", "stage8_vertical_slice_source_copied", "Stage 8-A vertical slice source copied"));

  if (
    !validation.valid ||
    source.chainExecuted !== true ||
    source.finalRecord.status !== "mock_completed" ||
    source.inMemoryOnly !== true ||
    source.mockRunnerOnly !== true
  ) {
    findings.push(finding("blocking", "stage8_control_bundle_validation_failed", "Control bundle validation failed"));
    findings.push(finding("blocking", "stage8_control_bundle_blocked", "Stage 8-B control bundle is blocked"));
    return;
  }

  if (!stage9EntryReady || !confirmationsSatisfied) {
    if (!stage9EntryReady) {
      findings.push(finding("warning", "stage9_entry_deferred", "Stage 9 entry candidate is not ready"));
    }
    findings.push(finding("warning", "stage8_control_bundle_deferred", "Stage 8-B control bundle defers"));
    return;
  }

  findings.push(finding("info", "api_route_design_candidate_defined", "API route design candidate defined"));
  findings.push(finding("info", "runner_adapter_design_candidate_defined", "Runner adapter design candidate defined"));
  findings.push(finding("info", "mock_runner_adapter_candidate_defined", "Mock runner adapter design candidate defined"));
  findings.push(finding("info", "state_transition_contract_defined", "State transition contract defined"));
  findings.push(finding("info", "audit_event_contract_defined", "Audit event contract defined"));
  findings.push(finding("info", "approval_boundary_defined", "Approval boundary defined"));
  findings.push(finding("info", "no_run_boundary_verified", "No-run boundary verified"));
  findings.push(finding("info", "stage9_entry_candidate_defined", "Stage 9 entry candidate defined"));
  findings.push(finding("info", "stage9_separate_approval_required", "Stage 9 entry requires separate approval"));
  findings.push(finding("info", "stage9_implementation_disallowed", "Stage 9 implementation disallowed in this step"));

  if (decision === "stage8_runtime_control_bundle_ready") {
    findings.push(finding("info", "stage9_api_route_design_allowed", "Stage 9 API route design is allowed for in-memory MVP"));
    findings.push(finding("info", "stage9_in_memory_store_allowed", "Stage 9 in-memory store is allowed"));
    findings.push(finding("info", "stage9_mock_runner_adapter_allowed", "Stage 9 mock runner adapter is allowed"));
    findings.push(finding("info", "stage9_external_execution_disallowed", "Stage 9 actual external execution remains disallowed"));
    findings.push(finding("info", "stage9_db_persistence_disallowed", "Stage 9 DB persistence remains disallowed"));
    findings.push(finding("info", "stage9_ui_implementation_disallowed", "Stage 9 UI implementation remains disallowed"));
    findings.push(finding("info", "stage8_runtime_control_bundle_ready", "Stage 8 runtime control bundle is ready"));
  }
}
