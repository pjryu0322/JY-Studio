/**
 * Stage 7-C contract bundle closure findings builder (read-only).
 */

import type { RuntimeApiContractDesignReport } from "@/lib/agents/runtimeApiContractDesignTypes";
import type {
  ParsedRuntimeContractBundleClosureInput,
  RuntimeContractBundleClosureDecision,
  RuntimeContractBundleClosureFinding,
  RuntimeContractBundleValidationResult,
} from "@/lib/agents/runtimeContractBundleClosureTypes";

function finding(
  severity: RuntimeContractBundleClosureFinding["severity"],
  code: string,
  message: string,
): RuntimeContractBundleClosureFinding {
  return { severity, code, message };
}

export function appendRuntimeContractBundleClosureFindings(input: {
  readonly findings: RuntimeContractBundleClosureFinding[];
  readonly decision: RuntimeContractBundleClosureDecision;
  readonly source: RuntimeApiContractDesignReport;
  readonly parsed: ParsedRuntimeContractBundleClosureInput;
  readonly bundleValidation: RuntimeContractBundleValidationResult;
  readonly stage8EntryReady: boolean;
}): void {
  const { findings, decision, source, parsed, bundleValidation, stage8EntryReady } = input;

  findings.push(
    finding("info", "runtime_contract_bundle_closure_created", "Stage 7-C contract bundle closure evaluator created"),
  );
  findings.push(
    finding("info", "runtime_contract_bundle_closure_only", "Stage 7-C remains closure-only; no implementation permission"),
  );

  if (source.decision === "blocked") {
    findings.push(finding("blocking", "source_api_contract_blocked", "Source Stage 7-B API contract design is blocked"));
    findings.push(finding("blocking", "stage7_contract_bundle_closure_blocked", "Stage 7-C contract bundle closure is blocked"));
    return;
  }

  if (source.decision === "defer" || source.decision !== "ready_for_execution_runner_contract_design") {
    findings.push(finding("warning", "source_api_contract_not_ready", "Source Stage 7-B API contract design is not ready"));
    if (!parsed.runtimeContractBundleReviewed) {
      findings.push(finding("warning", "stage7_contract_bundle_closure_deferred", "runtimeContractBundleReviewed is missing"));
    }
    if (!parsed.runtimeContractBundleNoImplementationConfirmed) {
      findings.push(finding("warning", "stage7_contract_bundle_closure_deferred", "runtimeContractBundleNoImplementationConfirmed is missing"));
    }
    if (!parsed.runtimeContractBundleStage8EntryReviewed) {
      findings.push(finding("warning", "stage7_contract_bundle_closure_deferred", "runtimeContractBundleStage8EntryReviewed is missing"));
    }
    if (!parsed.runtimeContractBundleSeparatedWorkConfirmed) {
      findings.push(finding("warning", "stage7_contract_bundle_closure_deferred", "runtimeContractBundleSeparatedWorkConfirmed is missing"));
    }
    if (!parsed.runtimeContractBundleRollbackReviewed) {
      findings.push(finding("warning", "stage7_contract_bundle_closure_deferred", "runtimeContractBundleRollbackReviewed is missing"));
    }
    findings.push(finding("warning", "stage7_contract_bundle_closure_deferred", "Stage 7-C contract bundle closure defers"));
    return;
  }

  if (
    source.endpointContractCount < 6 ||
    source.endpointDesignOnlyCount !== source.endpointContractCount ||
    source.implementedEndpointCount !== 0 ||
    source.sourceActualRuntimeExecutionAllowedInThisStep !== false ||
    source.sourceActualExecutionRunnerAllowedInThisStep !== false ||
    source.sourceActualDryRunRunnerAllowedInThisStep !== false ||
    source.sourceActualExecutionWireAllowedInThisStep !== false ||
    source.sourceActualPersistenceAllowedInThisStep !== false ||
    source.sourceActualExternalSideEffectAllowedInThisStep !== false ||
    source.sourceActualSchemaMigrationAllowedInThisStep !== false ||
    source.sourceActualCursorGithubWireAllowedInThisStep !== false ||
    source.sourceActualConnectorRoutingChangeAllowedInThisStep !== false ||
    source.sourceActualUiImplementationAllowedInThisStep !== false ||
    !bundleValidation.valid
  ) {
    if (!bundleValidation.valid) {
      findings.push(finding("blocking", "bundle_items_validation_failed", "Bundle items validation failed"));
    }
    findings.push(finding("blocking", "stage7_contract_bundle_closure_blocked", "Stage 7-C contract bundle closure is blocked"));
    return;
  }

  if (!stage8EntryReady || !parsed.confirmationsSatisfied) {
    if (!stage8EntryReady) {
      findings.push(finding("warning", "stage8_entry_candidate_defined", "Stage 8 entry candidate is not ready"));
    }
    findings.push(finding("warning", "stage7_contract_bundle_closure_deferred", "Stage 7-C contract bundle closure defers"));
    return;
  }

  findings.push(finding("info", "source_api_contract_trace_copied", "Stage 7-B API contract trace copied into bundle closure report"));
  findings.push(finding("info", "bundle_items_validation_passed", "All required bundle items validated"));
  findings.push(finding("info", "bundle_items_design_only_verified", "All bundle items remain design-only"));
  findings.push(finding("info", "bundle_items_stage8_scope_verified", "Stage 8 entry bundle item scope boundaries verified"));
  findings.push(finding("info", "bundle_items_separate_approval_verified", "Stage 8 entry separate approval requirements verified"));
  findings.push(finding("info", "stage8_entry_candidate_defined", "Stage 8-A minimal vertical slice entry candidate is defined"));
  findings.push(finding("info", "stage8_entry_scope_defined", "Stage 8-A minimal vertical slice scope is defined"));
  findings.push(finding("info", "stage8_entry_out_of_scope_defined", "Stage 8-A out-of-scope boundaries are defined"));
  findings.push(finding("info", "stage8_entry_separate_approval_required", "Stage 8 entry requires separate operator approval"));
  findings.push(finding("info", "stage8_entry_implementation_disallowed", "Stage 8 implementation remains disallowed in this step"));
  findings.push(finding("info", "stage8_entry_requires_operator_approval", "Stage 8 entry requires operator approval"));
  findings.push(finding("info", "actual_api_endpoint_still_disallowed", "Actual API endpoints remain disallowed after Stage 7"));
  findings.push(finding("info", "actual_runtime_execution_still_disallowed", "Actual runtime execution remains disallowed"));
  findings.push(finding("info", "actual_runner_still_disallowed", "Actual execution runner remains disallowed"));
  findings.push(finding("info", "actual_dry_run_runner_still_disallowed", "Actual dry-run runner remains disallowed"));
  findings.push(finding("info", "actual_execution_wire_still_disallowed", "Actual execution wire remains disallowed"));
  findings.push(finding("info", "actual_persistence_still_disallowed", "Actual persistence remains disallowed"));
  findings.push(finding("info", "actual_schema_migration_still_disallowed", "Actual schema migration remains disallowed"));
  findings.push(finding("info", "cursor_github_wire_still_disallowed", "Cursor/GitHub wire remains disallowed"));
  findings.push(finding("info", "connector_routing_change_still_disallowed", "Connector routing change remains disallowed"));
  findings.push(finding("info", "ui_implementation_still_disallowed", "UI implementation remains disallowed"));
  if (decision === "stage7_runtime_contract_bundle_closed") {
    findings.push(finding("info", "stage7_contract_bundle_closed", "Stage 7 runtime contract bundle is closed"));
    findings.push(
      finding("info", "stage7_closure_to_stage8_handoff_ready", "Stage 7 closure handoff to Stage 8-A is ready for separate approval"),
    );
  }
}
