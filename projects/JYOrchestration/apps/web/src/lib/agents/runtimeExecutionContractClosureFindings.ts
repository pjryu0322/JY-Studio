/**
 * Stage 6-F contract closure findings builder (read-only).
 */

import type { RuntimeExecutionDryRunContractReport } from "@/lib/agents/runtimeExecutionDryRunContractTypes";
import type {
  ParsedRuntimeExecutionContractClosureInput,
  RuntimeExecutionContractClosureDecision,
  RuntimeExecutionContractClosureFinding,
} from "@/lib/agents/runtimeExecutionContractClosureTypes";

function finding(
  severity: RuntimeExecutionContractClosureFinding["severity"],
  code: string,
  message: string,
): RuntimeExecutionContractClosureFinding {
  return { severity, code, message };
}

export function appendRuntimeExecutionContractClosureFindings(input: {
  readonly findings: RuntimeExecutionContractClosureFinding[];
  readonly decision: RuntimeExecutionContractClosureDecision;
  readonly source: RuntimeExecutionDryRunContractReport;
  readonly parsed: ParsedRuntimeExecutionContractClosureInput;
  readonly closureFingerprint: string;
}): void {
  const { findings, decision, source, parsed, closureFingerprint } = input;

  findings.push(
    finding("info", "runtime_execution_contract_closure_created", "Stage 6-F contract closure evaluator created"),
  );
  findings.push(
    finding("info", "runtime_execution_contract_closure_only", "Stage 6 closure remains design-only; no implementation permission"),
  );

  if (source.decision === "blocked") {
    findings.push(finding("blocking", "source_dry_run_contract_blocked", "Source Stage 6-E dry-run contract is blocked"));
    findings.push(finding("blocking", "stage6_contract_closure_blocked", "Stage 6-F contract closure is blocked"));
    return;
  }

  if (source.dryRunContractValidation.valid !== true) {
    findings.push(
      finding("blocking", "source_dry_run_contract_validation_failed", "Source dry-run contract validation failed"),
    );
    findings.push(finding("blocking", "stage6_contract_closure_blocked", "Stage 6-F contract closure is blocked"));
    return;
  }

  if (source.dryRunContractOnly !== true) {
    findings.push(
      finding("blocking", "source_dry_run_contract_boundary_violation", "Source dry-run contract boundary violation"),
    );
    findings.push(finding("blocking", "stage6_contract_closure_blocked", "Stage 6-F contract closure is blocked"));
    return;
  }

  if (source.actualRuntimeExecutionAllowedInThisStep !== false) {
    findings.push(
      finding("blocking", "stage6_source_actual_runtime_boundary_violation", "Source actual runtime execution boundary violated"),
    );
    findings.push(finding("blocking", "stage6_contract_closure_blocked", "Stage 6-F contract closure is blocked"));
    return;
  }

  if (source.actualExecutionRunnerAllowedInThisStep !== false) {
    findings.push(
      finding("blocking", "stage6_source_actual_runner_boundary_violation", "Source actual execution runner boundary violated"),
    );
    findings.push(finding("blocking", "stage6_contract_closure_blocked", "Stage 6-F contract closure is blocked"));
    return;
  }

  if (source.actualDryRunRunnerAllowedInThisStep !== false) {
    findings.push(
      finding("blocking", "stage6_source_actual_dry_run_runner_boundary_violation", "Source actual dry-run runner boundary violated"),
    );
    findings.push(finding("blocking", "stage6_contract_closure_blocked", "Stage 6-F contract closure is blocked"));
    return;
  }

  if (source.actualExecutionWireAllowedInThisStep !== false) {
    findings.push(
      finding("blocking", "stage6_source_actual_wire_boundary_violation", "Source actual execution wire boundary violated"),
    );
    findings.push(finding("blocking", "stage6_contract_closure_blocked", "Stage 6-F contract closure is blocked"));
    return;
  }

  if (source.actualPersistenceAllowedInThisStep !== false) {
    findings.push(
      finding("blocking", "stage6_source_actual_persistence_boundary_violation", "Source actual persistence boundary violated"),
    );
    findings.push(finding("blocking", "stage6_contract_closure_blocked", "Stage 6-F contract closure is blocked"));
    return;
  }

  if (source.actualExternalSideEffectAllowedInThisStep !== false) {
    findings.push(
      finding("blocking", "stage6_source_actual_wire_boundary_violation", "Source actual external side-effect boundary violated"),
    );
    findings.push(finding("blocking", "stage6_contract_closure_blocked", "Stage 6-F contract closure is blocked"));
    return;
  }

  if (source.actualSchemaMigrationAllowedInThisStep !== false) {
    findings.push(
      finding("blocking", "stage6_source_actual_schema_boundary_violation", "Source actual schema migration boundary violated"),
    );
    findings.push(finding("blocking", "stage6_contract_closure_blocked", "Stage 6-F contract closure is blocked"));
    return;
  }

  if (source.actualCursorGithubWireAllowedInThisStep !== false) {
    findings.push(
      finding("blocking", "stage6_source_actual_wire_boundary_violation", "Source Cursor/GitHub wire boundary violated"),
    );
    findings.push(finding("blocking", "stage6_contract_closure_blocked", "Stage 6-F contract closure is blocked"));
    return;
  }

  if (source.actualConnectorRoutingChangeAllowedInThisStep !== false) {
    findings.push(
      finding("blocking", "stage6_source_actual_connector_routing_boundary_violation", "Source connector routing boundary violated"),
    );
    findings.push(finding("blocking", "stage6_contract_closure_blocked", "Stage 6-F contract closure is blocked"));
    return;
  }

  if (decision === "defer") {
    if (
      source.decision === "defer" ||
      source.decision !== "ready_for_runtime_execution_contract_closure"
    ) {
      findings.push(
        finding("warning", "source_dry_run_contract_not_ready", "Source Stage 6-E dry-run contract is not ready"),
      );
    }
    if (!parsed.runtimeExecutionContractClosureConfirmed) {
      findings.push(
        finding("warning", "stage6_contract_closure_deferred", "runtimeExecutionContractClosureConfirmed is missing"),
      );
    }
    if (!parsed.runtimeExecutionNoActualRunnerConfirmed) {
      findings.push(
        finding("warning", "stage6_contract_closure_deferred", "runtimeExecutionNoActualRunnerConfirmed is missing"),
      );
    }
    if (!parsed.runtimeExecutionNoPersistenceConfirmed) {
      findings.push(
        finding("warning", "stage6_contract_closure_deferred", "runtimeExecutionNoPersistenceConfirmed is missing"),
      );
    }
    if (!parsed.runtimeExecutionSeparatedWorkReviewed) {
      findings.push(
        finding("warning", "stage6_contract_closure_deferred", "runtimeExecutionSeparatedWorkReviewed is missing"),
      );
    }
    if (!parsed.runtimeExecutionStage7HandoffReviewed) {
      findings.push(
        finding("warning", "stage6_contract_closure_deferred", "runtimeExecutionStage7HandoffReviewed is missing"),
      );
    }
    findings.push(finding("warning", "stage6_contract_closure_deferred", "Stage 6-F contract closure defers"));
    return;
  }

  findings.push(finding("info", "source_dry_run_contract_trace_copied", "Stage 6-E dry-run contract trace copied into closure report"));
  findings.push(
    finding("info", "stage6_source_actual_runtime_boundary_verified", "Source actual runtime execution boundary verified as disallowed"),
  );
  findings.push(
    finding("info", "stage6_source_actual_runner_boundary_verified", "Source actual execution runner boundary verified as disallowed"),
  );
  findings.push(
    finding("info", "stage6_source_actual_dry_run_runner_boundary_verified", "Source actual dry-run runner boundary verified as disallowed"),
  );
  findings.push(
    finding("info", "stage6_source_actual_wire_boundary_verified", "Source actual execution wire boundary verified as disallowed"),
  );
  findings.push(
    finding("info", "stage6_source_actual_persistence_boundary_verified", "Source actual persistence boundary verified as disallowed"),
  );
  findings.push(
    finding("info", "stage6_source_actual_schema_boundary_verified", "Source actual schema migration boundary verified as disallowed"),
  );
  findings.push(
    finding("info", "stage6_source_actual_connector_routing_boundary_verified", "Source connector routing boundary verified as disallowed"),
  );
  findings.push(
    finding("info", "stage6_contract_closure_fingerprint_created", `Closure fingerprint created: ${closureFingerprint}`),
  );
  findings.push(finding("info", "stage6_chain_closed", "Stage 6-A through 6-E read-only design chain is closed"));
  findings.push(
    finding("info", "stage6_actual_runtime_execution_still_disallowed", "Actual runtime execution remains disallowed after Stage 6"),
  );
  findings.push(
    finding("info", "stage6_actual_runner_still_disallowed", "Actual execution runner remains disallowed after Stage 6"),
  );
  findings.push(
    finding("info", "stage6_actual_persistence_still_disallowed", "Actual persistence remains disallowed after Stage 6"),
  );
  findings.push(
    finding("info", "stage6_actual_schema_migration_still_disallowed", "Actual schema migration remains disallowed after Stage 6"),
  );
  findings.push(
    finding("info", "stage7_requires_separate_approval", "Stage 7 implementation requires separate approval"),
  );
}
