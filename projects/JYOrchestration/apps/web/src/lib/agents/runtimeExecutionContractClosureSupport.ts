/**
 * Stage 6-F runtime execution contract closure support (read-only).
 */

import { evaluateRuntimeExecutionDryRunContract } from "@/lib/agents/evaluateRuntimeExecutionDryRunContract";
import type { RuntimeExecutionDryRunContractReport } from "@/lib/agents/runtimeExecutionDryRunContractTypes";
import {
  REQUIRED_STAGE6_F_CONTRACT_CLOSURE_CONFIRMATIONS,
  RUNTIME_EXECUTION_CONTRACT_CLOSURE_TITLE,
  RUNTIME_EXECUTION_CONTRACT_CLOSURE_VERSION,
  STAGE6_CLOSED_STAGES,
  STAGE6_F_RECOMMENDED_NEXT_PHASES,
  STAGE6_F_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/runtimeExecutionContractClosureConstants";
import type {
  ParsedRuntimeExecutionContractClosureInput,
  RuntimeExecutionContractClosureChecklistItem,
  RuntimeExecutionContractClosureDecision,
  RuntimeExecutionContractClosureDecisionInput,
  RuntimeExecutionContractClosureFinding,
  RuntimeExecutionContractClosureInput,
} from "@/lib/agents/runtimeExecutionContractClosureTypes";

type ChecklistEntry = {
  readonly item: string;
  readonly area: RuntimeExecutionContractClosureChecklistItem["area"];
  readonly satisfied: boolean;
  readonly detail: string;
};

function finding(
  severity: RuntimeExecutionContractClosureFinding["severity"],
  code: string,
  message: string,
): RuntimeExecutionContractClosureFinding {
  return { severity, code, message };
}

function mapChecklist(entries: readonly ChecklistEntry[]): RuntimeExecutionContractClosureChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    area: entry.area,
    satisfied: entry.satisfied,
    reason: `${entry.item}: ${entry.satisfied ? "satisfied" : "not satisfied"} — ${entry.detail}`,
  }));
}

export function parseRuntimeExecutionContractClosureInput(
  input?: RuntimeExecutionContractClosureInput,
): ParsedRuntimeExecutionContractClosureInput {
  const flags = [
    input?.runtimeExecutionContractClosureConfirmed === true,
    input?.runtimeExecutionNoActualRunnerConfirmed === true,
    input?.runtimeExecutionNoPersistenceConfirmed === true,
    input?.runtimeExecutionSeparatedWorkReviewed === true,
    input?.runtimeExecutionStage7HandoffReviewed === true,
  ];
  return {
    runtimeExecutionContractClosureConfirmed: flags[0],
    runtimeExecutionNoActualRunnerConfirmed: flags[1],
    runtimeExecutionNoPersistenceConfirmed: flags[2],
    runtimeExecutionSeparatedWorkReviewed: flags[3],
    runtimeExecutionStage7HandoffReviewed: flags[4],
    confirmationsSatisfied: flags.every(Boolean),
    confirmationCount: flags.filter(Boolean).length,
  };
}

export function resolveRuntimeExecutionContractClosureDecision(
  input: RuntimeExecutionContractClosureDecisionInput,
): RuntimeExecutionContractClosureDecision {
  if (input.sourceDryRunContractDecision === "blocked") {
    return "blocked";
  }

  if (input.sourceDryRunContractDecision === "defer") {
    return "defer";
  }

  if (input.sourceDryRunContractDecision !== "ready_for_runtime_execution_contract_closure") {
    return "defer";
  }

  if (
    input.sourceDryRunContractOnly !== true ||
    input.sourceDryRunContractValidationValid !== true ||
    input.sourceNoRunBoundarySatisfied !== true ||
    input.sourcePersistenceBoundarySatisfied !== true ||
    input.sourceSchemaMigrationBoundarySatisfied !== true ||
    input.sourceDryRunContractItemCount < 7 ||
    input.sourceDryRunScenarioCount < 7 ||
    input.sourceDryRunAssertionCount < 14
  ) {
    return "blocked";
  }

  if (!input.confirmationsSatisfied) {
    return "defer";
  }

  return "stage6_runtime_execution_contract_closed";
}

export function buildRuntimeExecutionContractClosureFingerprint(input: {
  readonly sourceDryRunContractFingerprint: string;
  readonly closedStageCount: number;
  readonly confirmationCount: number;
  readonly sourceNoRunBoundarySatisfied: boolean;
  readonly sourcePersistenceBoundarySatisfied: boolean;
  readonly sourceSchemaMigrationBoundarySatisfied: boolean;
}): string {
  return [
    "runtime-execution-contract-closure-v1",
    input.sourceDryRunContractFingerprint,
    `closedStages:${input.closedStageCount}`,
    `confirmations:${input.confirmationCount}`,
    `noRun:${input.sourceNoRunBoundarySatisfied}`,
    `persistence:${input.sourcePersistenceBoundarySatisfied}`,
    `schema:${input.sourceSchemaMigrationBoundarySatisfied}`,
  ].join("::");
}

export function buildRuntimeExecutionContractClosureSummary(
  decision: RuntimeExecutionContractClosureDecision,
): string {
  if (decision === "blocked") {
    return "Stage 6-F runtime execution contract closure is blocked.";
  }
  if (decision === "defer") {
    return "Stage 6-F contract closure defers; dry-run contract or confirmations are incomplete.";
  }
  return "Stage 6-A through 6-E read-only runtime execution contract design chain is closed. Actual implementation requires Stage 7 or separate PR approval.";
}

export function buildStage6ClosureSummary(decision: RuntimeExecutionContractClosureDecision): string {
  if (decision !== "stage6_runtime_execution_contract_closed") {
    return "Stage 6 runtime execution contract chain is not closed.";
  }
  return `Closed stages: ${STAGE6_CLOSED_STAGES.join(", ")}. Actual runtime execution remains disallowed after Stage 6.`;
}

export function buildRuntimeExecutionContractClosureChecklists(input: {
  readonly parsed: ParsedRuntimeExecutionContractClosureInput;
  readonly source: RuntimeExecutionDryRunContractReport;
}): {
  readonly closureChecklist: readonly RuntimeExecutionContractClosureChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeExecutionContractClosureChecklistItem[];
  readonly handoffChecklist: readonly RuntimeExecutionContractClosureChecklistItem[];
} {
  const sourceReady = input.source.decision === "ready_for_runtime_execution_contract_closure";

  const closureChecklist = mapChecklist([
    {
      item: "stage_6_a_baseline_closed",
      area: "runtime_model_baseline",
      satisfied: sourceReady,
      detail: "Stage 6-A baseline included in closed chain",
    },
    {
      item: "stage_6_b_candidate_closed",
      area: "runtime_model_candidate",
      satisfied: sourceReady,
      detail: "Stage 6-B candidate included in closed chain",
    },
    {
      item: "stage_6_c_review_gate_closed",
      area: "runtime_model_review_gate",
      satisfied: sourceReady,
      detail: "Stage 6-C review gate included in closed chain",
    },
    {
      item: "stage_6_d_contract_candidate_closed",
      area: "runtime_contract_candidate",
      satisfied: sourceReady,
      detail: "Stage 6-D contract candidate included in closed chain",
    },
    {
      item: "stage_6_e_dry_run_contract_closed",
      area: "runtime_dry_run_contract",
      satisfied: sourceReady,
      detail: "Stage 6-E dry-run contract included in closed chain",
    },
    {
      item: "stage_6_closure_confirmation_complete",
      area: "stage6_chain_closure",
      satisfied: input.parsed.confirmationsSatisfied,
      detail: `confirmationsSatisfied=${input.parsed.confirmationsSatisfied}`,
    },
  ]);

  const boundaryChecklist = mapChecklist([
    {
      item: "no_actual_runtime_execution",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualRuntimeExecutionAllowedInThisStep=false",
    },
    {
      item: "no_actual_execution_runner",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualExecutionRunnerAllowedInThisStep=false",
    },
    {
      item: "no_actual_dry_run_runner",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualDryRunRunnerAllowedInThisStep=false",
    },
    {
      item: "no_actual_persistence",
      area: "persistence_boundary",
      satisfied: true,
      detail: "actualPersistenceAllowedInThisStep=false",
    },
    {
      item: "no_actual_schema_migration",
      area: "schema_boundary",
      satisfied: true,
      detail: "actualSchemaMigrationAllowedInThisStep=false",
    },
    {
      item: "no_connector_routing_change",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualConnectorRoutingChangeAllowedInThisStep=false",
    },
    {
      item: "no_cursor_github_wire",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualCursorGithubWireAllowedInThisStep=false",
    },
  ]);

  const handoffChecklist = mapChecklist([
    {
      item: "separated_work_items_defined",
      area: "separated_work",
      satisfied: STAGE6_F_SEPARATED_WORK_ITEMS.length > 0,
      detail: `separatedWorkItemCount=${STAGE6_F_SEPARATED_WORK_ITEMS.length}`,
    },
    {
      item: "stage7_requires_separate_approval",
      area: "stage6_chain_closure",
      satisfied: input.parsed.runtimeExecutionStage7HandoffReviewed,
      detail: `runtimeExecutionStage7HandoffReviewed=${input.parsed.runtimeExecutionStage7HandoffReviewed}`,
    },
    {
      item: "implementation_prs_are_out_of_scope",
      area: "separated_work",
      satisfied: input.parsed.runtimeExecutionSeparatedWorkReviewed,
      detail: `runtimeExecutionSeparatedWorkReviewed=${input.parsed.runtimeExecutionSeparatedWorkReviewed}`,
    },
  ]);

  return { closureChecklist, boundaryChecklist, handoffChecklist };
}

export function appendRuntimeExecutionContractClosureFindings(input: {
  readonly findings: RuntimeExecutionContractClosureFinding[];
  readonly decision: RuntimeExecutionContractClosureDecision;
  readonly source: RuntimeExecutionDryRunContractReport;
  readonly parsed: ParsedRuntimeExecutionContractClosureInput;
}): void {
  const { findings, decision, source, parsed } = input;

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

/** Evaluate source Stage 6-E report for contract closure. */
export function evaluateRuntimeExecutionContractClosureSource(
  input?: RuntimeExecutionContractClosureInput,
): RuntimeExecutionDryRunContractReport {
  return evaluateRuntimeExecutionDryRunContract(input?.dryRunContract);
}

export {
  REQUIRED_STAGE6_F_CONTRACT_CLOSURE_CONFIRMATIONS,
  RUNTIME_EXECUTION_CONTRACT_CLOSURE_TITLE,
  RUNTIME_EXECUTION_CONTRACT_CLOSURE_VERSION,
  STAGE6_CLOSED_STAGES,
  STAGE6_F_RECOMMENDED_NEXT_PHASES,
  STAGE6_F_SEPARATED_WORK_ITEMS,
};
