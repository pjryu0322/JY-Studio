/**
 * Stage 6-E runtime execution dry-run contract support (read-only).
 */

import { evaluateRuntimeExecutionContractCandidate } from "@/lib/agents/evaluateRuntimeExecutionContractCandidate";
import type { RuntimeExecutionContractCandidateReport } from "@/lib/agents/runtimeExecutionContractCandidateTypes";
import {
  COMMON_DRY_RUN_BOUNDARY_RULES,
  CONTRACT_ID_TO_DRY_RUN_SPEC,
  REQUIRED_RUNTIME_EXECUTION_DRY_RUN_CONTRACT_IDS,
  REQUIRED_STAGE6_E_DRY_RUN_CONTRACT_CONFIRMATIONS,
  RUNTIME_EXECUTION_DRY_RUN_CONTRACT_TITLE,
  RUNTIME_EXECUTION_DRY_RUN_CONTRACT_VERSION,
  STAGE6_E_RECOMMENDED_NEXT_PHASES,
  STAGE6_E_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/runtimeExecutionDryRunContractConstants";
import type {
  ParsedRuntimeExecutionDryRunContractInput,
  RuntimeExecutionDryRunContractChecklistItem,
  RuntimeExecutionDryRunContractDecision,
  RuntimeExecutionDryRunContractDecisionInput,
  RuntimeExecutionDryRunContractFinding,
  RuntimeExecutionDryRunContractInput,
  RuntimeExecutionDryRunContractItem,
} from "@/lib/agents/runtimeExecutionDryRunContractTypes";

type ChecklistEntry = {
  readonly item: string;
  readonly area: RuntimeExecutionDryRunContractChecklistItem["area"];
  readonly satisfied: boolean;
  readonly detail: string;
};

function finding(
  severity: RuntimeExecutionDryRunContractFinding["severity"],
  code: string,
  message: string,
): RuntimeExecutionDryRunContractFinding {
  return { severity, code, message };
}

function mapChecklist(entries: readonly ChecklistEntry[]): RuntimeExecutionDryRunContractChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    area: entry.area,
    satisfied: entry.satisfied,
    reason: `${entry.item}: ${entry.satisfied ? "satisfied" : "not satisfied"} — ${entry.detail}`,
  }));
}

function sourceReadyForDryRunContracts(source: RuntimeExecutionContractCandidateReport): boolean {
  return (
    source.decision === "ready_for_runtime_execution_dry_run_contract" &&
    source.contractCandidateOnly === true &&
    source.sourceNoRunBoundarySatisfied === true &&
    source.sourcePersistenceBoundarySatisfied === true &&
    source.sourceSchemaMigrationBoundarySatisfied === true &&
    source.contractCandidateValidation.valid === true
  );
}

export function parseRuntimeExecutionDryRunContractInput(
  input?: RuntimeExecutionDryRunContractInput,
): ParsedRuntimeExecutionDryRunContractInput {
  const flags = [
    input?.runtimeExecutionDryRunContractConfirmed === true,
    input?.runtimeExecutionDryRunBoundaryReviewed === true,
    input?.runtimeExecutionDryRunNoRunnerConfirmed === true,
    input?.runtimeExecutionDryRunPersistenceReviewed === true,
    input?.runtimeExecutionDryRunRollbackReviewed === true,
  ];
  return {
    runtimeExecutionDryRunContractConfirmed: flags[0],
    runtimeExecutionDryRunBoundaryReviewed: flags[1],
    runtimeExecutionDryRunNoRunnerConfirmed: flags[2],
    runtimeExecutionDryRunPersistenceReviewed: flags[3],
    runtimeExecutionDryRunRollbackReviewed: flags[4],
    confirmationsSatisfied: flags.every(Boolean),
    confirmationCount: flags.filter(Boolean).length,
  };
}

export function buildRuntimeExecutionDryRunContractItems(
  source: RuntimeExecutionContractCandidateReport,
): readonly RuntimeExecutionDryRunContractItem[] {
  if (!sourceReadyForDryRunContracts(source)) {
    return [];
  }

  return source.contractCandidates
    .map((contract) => {
      const spec = CONTRACT_ID_TO_DRY_RUN_SPEC[contract.contractId];
      if (!spec) {
        return null;
      }
      return {
        dryRunContractId: spec.dryRunContractId,
        area: spec.area,
        sourceContractId: contract.contractId,
        scenarioName: spec.scenarioName,
        purpose: `Dry-run scenario for ${contract.contractName}; does not execute runtime.`,
        requiredInputs: [
          `${spec.dryRunContractId}:input:request`,
          `${spec.dryRunContractId}:input:context`,
        ],
        expectedAssertions: [
          `${spec.dryRunContractId}:assert:no_side_effect`,
          `${spec.dryRunContractId}:assert:candidate_only`,
        ],
        boundaryRules: [
          ...COMMON_DRY_RUN_BOUNDARY_RULES,
          `source_contract:${contract.contractId}`,
        ],
        dryRunOnly: true,
        implementedInThisStep: false,
      } satisfies RuntimeExecutionDryRunContractItem;
    })
    .filter((item): item is RuntimeExecutionDryRunContractItem => item !== null);
}

export function validateRuntimeExecutionDryRunContractItems(
  items: readonly RuntimeExecutionDryRunContractItem[],
): boolean {
  if (items.length !== REQUIRED_RUNTIME_EXECUTION_DRY_RUN_CONTRACT_IDS.length) {
    return false;
  }
  const ids = new Set(items.map((item) => item.dryRunContractId));
  if (!REQUIRED_RUNTIME_EXECUTION_DRY_RUN_CONTRACT_IDS.every((id) => ids.has(id))) {
    return false;
  }
  return items.every(
    (item) =>
      item.dryRunOnly === true &&
      item.implementedInThisStep === false &&
      item.requiredInputs.length >= 2 &&
      item.expectedAssertions.length >= 2 &&
      item.boundaryRules.length >= 2,
  );
}

export function computeRuntimeExecutionDryRunContractTrace(items: readonly RuntimeExecutionDryRunContractItem[]): {
  readonly dryRunContractItemCount: number;
  readonly dryRunScenarioCount: number;
  readonly dryRunAssertionCount: number;
} {
  return {
    dryRunContractItemCount: items.length,
    dryRunScenarioCount: items.length,
    dryRunAssertionCount: items.reduce((sum, item) => sum + item.expectedAssertions.length, 0),
  };
}

export function resolveRuntimeExecutionDryRunContractDecision(
  input: RuntimeExecutionDryRunContractDecisionInput,
): RuntimeExecutionDryRunContractDecision {
  if (input.sourceContractCandidateDecision === "blocked") {
    return "blocked";
  }

  if (input.sourceContractCandidateDecision === "defer") {
    return "defer";
  }

  if (input.sourceContractCandidateDecision !== "ready_for_runtime_execution_dry_run_contract") {
    return "defer";
  }

  if (
    input.sourceContractCandidateOnly !== true ||
    input.sourceNoRunBoundarySatisfied !== true ||
    input.sourcePersistenceBoundarySatisfied !== true ||
    input.sourceSchemaMigrationBoundarySatisfied !== true ||
    input.sourceContractCandidateCount < 7 ||
    !input.dryRunContractItemsValid
  ) {
    return "blocked";
  }

  if (!input.confirmationsSatisfied) {
    return "defer";
  }

  return "ready_for_runtime_execution_contract_closure";
}

export function buildRuntimeExecutionDryRunContractFingerprint(input: {
  readonly sourceContractCandidateFingerprint: string;
  readonly dryRunContractItemCount: number;
  readonly dryRunScenarioCount: number;
  readonly dryRunAssertionCount: number;
  readonly confirmationCount: number;
  readonly sourceNoRunBoundarySatisfied: boolean;
  readonly sourcePersistenceBoundarySatisfied: boolean;
  readonly sourceSchemaMigrationBoundarySatisfied: boolean;
}): string {
  return [
    "runtime-execution-dry-run-contract-v1",
    input.sourceContractCandidateFingerprint,
    `items:${input.dryRunContractItemCount}`,
    `scenarios:${input.dryRunScenarioCount}`,
    `assertions:${input.dryRunAssertionCount}`,
    `confirmations:${input.confirmationCount}`,
    `noRun:${input.sourceNoRunBoundarySatisfied}`,
    `persistence:${input.sourcePersistenceBoundarySatisfied}`,
    `schema:${input.sourceSchemaMigrationBoundarySatisfied}`,
  ].join("::");
}

export function buildRuntimeExecutionDryRunContractSummary(
  decision: RuntimeExecutionDryRunContractDecision,
): string {
  if (decision === "blocked") {
    return "Stage 6-E runtime execution dry-run contract is blocked.";
  }
  if (decision === "defer") {
    return "Stage 6-E dry-run contract defers; contract candidate or confirmations are incomplete.";
  }
  return "Stage 6-E dry-run contracts are ready for contract closure design. This is not actual dry-run execution.";
}

export function buildRuntimeExecutionDryRunContractChecklists(input: {
  readonly dryRunContractItems: readonly RuntimeExecutionDryRunContractItem[];
  readonly parsed: ParsedRuntimeExecutionDryRunContractInput;
}): {
  readonly dryRunChecklist: readonly RuntimeExecutionDryRunContractChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeExecutionDryRunContractChecklistItem[];
} {
  const itemByArea = new Map(input.dryRunContractItems.map((item) => [item.area, item] as const));

  const dryRunChecklist = mapChecklist([
    {
      item: "7 dry-run contract items generated",
      area: "dry_run_boundary",
      satisfied: input.dryRunContractItems.length === 7,
      detail: `dryRunContractItemCount=${input.dryRunContractItems.length}`,
    },
    {
      item: "dry_run_request item present",
      area: "dry_run_request",
      satisfied: itemByArea.has("dry_run_request"),
      detail: "dry_run_request present",
    },
    {
      item: "dry_run_plan item present",
      area: "dry_run_plan",
      satisfied: itemByArea.has("dry_run_plan"),
      detail: "dry_run_plan present",
    },
    {
      item: "dry_run_step item present",
      area: "dry_run_step",
      satisfied: itemByArea.has("dry_run_step"),
      detail: "dry_run_step present",
    },
    {
      item: "dry_run_result item present",
      area: "dry_run_result",
      satisfied: itemByArea.has("dry_run_result"),
      detail: "dry_run_result present",
    },
    {
      item: "dry_run_finding item present",
      area: "dry_run_finding",
      satisfied: itemByArea.has("dry_run_finding"),
      detail: "dry_run_finding present",
    },
    {
      item: "dry_run_approval item present",
      area: "dry_run_approval",
      satisfied: itemByArea.has("dry_run_approval"),
      detail: "dry_run_approval present",
    },
    {
      item: "dry_run_rollback item present",
      area: "dry_run_rollback",
      satisfied: itemByArea.has("dry_run_rollback"),
      detail: "dry_run_rollback present",
    },
    {
      item: "dry-run contract confirmed",
      area: "dry_run_boundary",
      satisfied: input.parsed.runtimeExecutionDryRunContractConfirmed,
      detail: `runtimeExecutionDryRunContractConfirmed=${input.parsed.runtimeExecutionDryRunContractConfirmed}`,
    },
    {
      item: "dry-run no-runner confirmed",
      area: "dry_run_boundary",
      satisfied: input.parsed.runtimeExecutionDryRunNoRunnerConfirmed,
      detail: `runtimeExecutionDryRunNoRunnerConfirmed=${input.parsed.runtimeExecutionDryRunNoRunnerConfirmed}`,
    },
  ]);

  const boundaryChecklist = mapChecklist([
    {
      item: "actualRuntimeExecutionAllowedInThisStep=false",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualRuntimeExecutionAllowedInThisStep=false",
    },
    {
      item: "actualDryRunRunnerAllowedInThisStep=false",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualDryRunRunnerAllowedInThisStep=false",
    },
    {
      item: "actualExecutionRunnerAllowedInThisStep=false",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualExecutionRunnerAllowedInThisStep=false",
    },
    {
      item: "actualExecutionWireAllowedInThisStep=false",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualExecutionWireAllowedInThisStep=false",
    },
    {
      item: "actualPersistenceAllowedInThisStep=false",
      area: "persistence_boundary",
      satisfied: true,
      detail: "actualPersistenceAllowedInThisStep=false",
    },
    {
      item: "actualSchemaMigrationAllowedInThisStep=false",
      area: "schema_boundary",
      satisfied: true,
      detail: "actualSchemaMigrationAllowedInThisStep=false",
    },
    {
      item: "actualExternalSideEffectAllowedInThisStep=false",
      area: "no_run_boundary",
      satisfied: true,
      detail: "actualExternalSideEffectAllowedInThisStep=false",
    },
    {
      item: "dry-run boundary reviewed",
      area: "dry_run_boundary",
      satisfied: input.parsed.runtimeExecutionDryRunBoundaryReviewed,
      detail: `runtimeExecutionDryRunBoundaryReviewed=${input.parsed.runtimeExecutionDryRunBoundaryReviewed}`,
    },
  ]);

  return { dryRunChecklist, boundaryChecklist };
}

export function appendRuntimeExecutionDryRunContractFindings(input: {
  readonly findings: RuntimeExecutionDryRunContractFinding[];
  readonly decision: RuntimeExecutionDryRunContractDecision;
  readonly source: RuntimeExecutionContractCandidateReport;
  readonly parsed: ParsedRuntimeExecutionDryRunContractInput;
  readonly dryRunContractItemsValid: boolean;
}): void {
  const { findings, decision, source, parsed, dryRunContractItemsValid } = input;

  findings.push(
    finding("info", "runtime_execution_dry_run_contract_created", "Stage 6-E dry-run contract evaluator created"),
  );
  findings.push(
    finding("info", "runtime_execution_dry_run_contract_only", "Runtime execution dry-run contract remains design-only"),
  );

  if (source.decision === "blocked") {
    findings.push(finding("blocking", "source_contract_candidate_blocked", "Source Stage 6-D contract candidate is blocked"));
    findings.push(finding("blocking", "stage6_e_dry_run_contract_blocked", "Stage 6-E dry-run contract is blocked"));
    return;
  }

  if (source.contractCandidateOnly !== true) {
    findings.push(
      finding("blocking", "source_contract_candidate_boundary_violation", "Source contract candidate boundary violation"),
    );
    findings.push(finding("blocking", "stage6_e_dry_run_contract_blocked", "Stage 6-E dry-run contract is blocked"));
    return;
  }

  if (source.sourceNoRunBoundarySatisfied !== true) {
    findings.push(
      finding("blocking", "source_contract_candidate_boundary_violation", "Source no-run boundary not satisfied"),
    );
    findings.push(finding("blocking", "stage6_e_dry_run_contract_blocked", "Stage 6-E dry-run contract is blocked"));
    return;
  }

  if (source.sourcePersistenceBoundarySatisfied !== true) {
    findings.push(
      finding("blocking", "source_contract_candidate_boundary_violation", "Source persistence boundary not satisfied"),
    );
    findings.push(finding("blocking", "stage6_e_dry_run_contract_blocked", "Stage 6-E dry-run contract is blocked"));
    return;
  }

  if (source.sourceSchemaMigrationBoundarySatisfied !== true) {
    findings.push(
      finding("blocking", "source_contract_candidate_boundary_violation", "Source schema migration boundary not satisfied"),
    );
    findings.push(finding("blocking", "stage6_e_dry_run_contract_blocked", "Stage 6-E dry-run contract is blocked"));
    return;
  }

  if (!dryRunContractItemsValid) {
    findings.push(
      finding("blocking", "dry_run_contract_item_validation_failed", "Dry-run contract items failed validation"),
    );
    findings.push(finding("blocking", "stage6_e_dry_run_contract_blocked", "Stage 6-E dry-run contract is blocked"));
    return;
  }

  if (decision === "defer") {
    if (
      source.decision === "defer" ||
      source.decision !== "ready_for_runtime_execution_dry_run_contract"
    ) {
      findings.push(
        finding("warning", "source_contract_candidate_not_ready", "Source Stage 6-D contract candidate is not ready"),
      );
    }
    if (!parsed.runtimeExecutionDryRunContractConfirmed) {
      findings.push(
        finding("warning", "dry_run_contract_confirmation_missing", "runtimeExecutionDryRunContractConfirmed is missing"),
      );
    }
    if (!parsed.runtimeExecutionDryRunBoundaryReviewed) {
      findings.push(
        finding("warning", "dry_run_contract_confirmation_missing", "runtimeExecutionDryRunBoundaryReviewed is missing"),
      );
    }
    if (!parsed.runtimeExecutionDryRunNoRunnerConfirmed) {
      findings.push(
        finding("warning", "dry_run_contract_confirmation_missing", "runtimeExecutionDryRunNoRunnerConfirmed is missing"),
      );
    }
    if (!parsed.runtimeExecutionDryRunPersistenceReviewed) {
      findings.push(
        finding("warning", "dry_run_contract_confirmation_missing", "runtimeExecutionDryRunPersistenceReviewed is missing"),
      );
    }
    if (!parsed.runtimeExecutionDryRunRollbackReviewed) {
      findings.push(
        finding("warning", "dry_run_contract_confirmation_missing", "runtimeExecutionDryRunRollbackReviewed is missing"),
      );
    }
    findings.push(finding("warning", "stage6_e_dry_run_contract_deferred", "Stage 6-E dry-run contract defers"));
    return;
  }

  findings.push(finding("info", "dry_run_runner_not_implemented", "Actual dry-run runner is not implemented in this step"));
  findings.push(
    finding("info", "dry_run_persistence_not_implemented", "Dry-run persistence is not implemented in this step"),
  );
  findings.push(
    finding("info", "dry_run_schema_migration_disallowed", "Schema migration remains disallowed in dry-run contract step"),
  );
  findings.push(
    finding("info", "runtime_execution_contract_closure_ready", "Ready for runtime execution contract closure"),
  );
}

/** Evaluate source Stage 6-D report for dry-run contract. */
export function evaluateRuntimeExecutionDryRunContractSource(
  input?: RuntimeExecutionDryRunContractInput,
): RuntimeExecutionContractCandidateReport {
  return evaluateRuntimeExecutionContractCandidate(input?.contractCandidate);
}

export {
  REQUIRED_STAGE6_E_DRY_RUN_CONTRACT_CONFIRMATIONS,
  RUNTIME_EXECUTION_DRY_RUN_CONTRACT_TITLE,
  RUNTIME_EXECUTION_DRY_RUN_CONTRACT_VERSION,
  STAGE6_E_RECOMMENDED_NEXT_PHASES,
  STAGE6_E_SEPARATED_WORK_ITEMS,
};
