/**
 * Stage 9-A runtime execution API MVP findings (read-only).
 */

import type {
  RuntimeExecutionApiMvpDecision,
  RuntimeExecutionApiMvpFinding,
} from "@/lib/agents/runtimeExecutionApiMvpTypes";
import type { RuntimeControlBundleReport } from "@/lib/agents/runtimeControlBundleTypes";

function finding(
  severity: RuntimeExecutionApiMvpFinding["severity"],
  code: string,
  message: string,
): RuntimeExecutionApiMvpFinding {
  return { severity, code, message };
}

export function appendRuntimeExecutionApiMvpFindings(input: {
  readonly findings: RuntimeExecutionApiMvpFinding[];
  readonly decision: RuntimeExecutionApiMvpDecision;
  readonly source: RuntimeControlBundleReport;
  readonly confirmationsSatisfied: boolean;
}): void {
  const { findings, decision, source, confirmationsSatisfied } = input;

  findings.push(
    finding("info", "runtime_execution_api_mvp_created", "Stage 9-A runtime execution API MVP evaluator created"),
  );

  if (source.decision === "blocked") {
    findings.push(finding("blocking", "stage8_control_bundle_not_ready", "Source Stage 8-B control bundle is blocked"));
    findings.push(finding("blocking", "stage9_api_mvp_blocked", "Stage 9-A API MVP is blocked"));
    return;
  }

  if (source.decision === "defer" || source.decision !== "stage8_runtime_control_bundle_ready") {
    findings.push(finding("warning", "stage8_control_bundle_not_ready", "Source Stage 8-B control bundle is not ready"));
    if (!confirmationsSatisfied) {
      findings.push(
        finding("warning", "stage9_api_mvp_deferred", "Stage 9-A API MVP defers until confirmations are complete"),
      );
    } else {
      findings.push(finding("warning", "stage9_api_mvp_deferred", "Stage 9-A API MVP defers"));
    }
    return;
  }

  findings.push(finding("info", "stage8_control_bundle_source_copied", "Stage 8-B control bundle source copied"));
  findings.push(finding("info", "api_route_handlers_defined", "Runtime execution API route handlers defined"));
  findings.push(finding("info", "in_memory_store_service_defined", "In-memory store service defined"));
  findings.push(finding("info", "mock_runner_adapter_defined", "Mock runner adapter defined"));
  findings.push(finding("info", "approval_action_defined", "Approval action defined"));
  findings.push(finding("info", "audit_query_defined", "Audit query defined"));
  findings.push(finding("info", "no_external_execution_verified", "No external execution verified"));
  findings.push(finding("info", "no_db_persistence_verified", "No DB persistence verified"));

  if (decision === "stage9_runtime_execution_api_mvp_ready") {
    findings.push(finding("info", "stage9_runtime_execution_api_mvp_ready", "Stage 9 runtime execution API MVP is ready"));
  }
}
