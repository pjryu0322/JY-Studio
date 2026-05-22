/**
 * Stage 7-A runtime implementation planning candidate support (read-only).
 */

import { evaluateRuntimeExecutionContractClosure } from "@/lib/agents/evaluateRuntimeExecutionContractClosure";
import type { RuntimeExecutionContractClosureReport } from "@/lib/agents/runtimeExecutionContractClosureTypes";
import {
  REQUIRED_STAGE7_A_IMPLEMENTATION_PLANNING_CONFIRMATIONS,
  RUNTIME_IMPLEMENTATION_PLANNING_CANDIDATE_TITLE,
  RUNTIME_IMPLEMENTATION_PLANNING_CANDIDATE_VERSION,
  STAGE7_A_PLANNING_ITEM_SPECS,
  STAGE7_A_RECOMMENDED_NEXT_PHASES,
  STAGE7_A_REQUIRED_PLANNING_ITEM_IDS,
  STAGE7_A_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/runtimeImplementationPlanningCandidateConstants";
import type {
  ParsedRuntimeImplementationPlanningCandidateInput,
  RuntimeImplementationPlanningCandidateChecklistItem,
  RuntimeImplementationPlanningCandidateDecision,
  RuntimeImplementationPlanningCandidateDecisionInput,
  RuntimeImplementationPlanningCandidateFinding,
  RuntimeImplementationPlanningCandidateInput,
  RuntimeImplementationPlanningItem,
  RuntimeImplementationPlanningValidationResult,
} from "@/lib/agents/runtimeImplementationPlanningCandidateTypes";

const VALID_PR_TYPES = new Set<RuntimeImplementationPlanningItem["recommendedPrType"]>([
  "separate_pr",
  "design_pr",
  "approval_pr",
]);

function finding(
  severity: RuntimeImplementationPlanningCandidateFinding["severity"],
  code: string,
  message: string,
): RuntimeImplementationPlanningCandidateFinding {
  return { severity, code, message };
}

export function parseRuntimeImplementationPlanningCandidateInput(
  input?: RuntimeImplementationPlanningCandidateInput,
): ParsedRuntimeImplementationPlanningCandidateInput {
  const flags = [
    input?.runtimeImplementationPlanningReviewed === true,
    input?.runtimeImplementationSeparatePrConfirmed === true,
    input?.runtimeImplementationNoActualExecutionConfirmed === true,
    input?.runtimeImplementationRollbackPlanReviewed === true,
    input?.runtimeImplementationOperatorApprovalRequiredConfirmed === true,
  ];
  return {
    runtimeImplementationPlanningReviewed: flags[0],
    runtimeImplementationSeparatePrConfirmed: flags[1],
    runtimeImplementationNoActualExecutionConfirmed: flags[2],
    runtimeImplementationRollbackPlanReviewed: flags[3],
    runtimeImplementationOperatorApprovalRequiredConfirmed: flags[4],
    confirmationsSatisfied: flags.every(Boolean),
    confirmationCount: flags.filter(Boolean).length,
  };
}

function sourceReadyForPlanningItems(source: RuntimeExecutionContractClosureReport): boolean {
  return (
    source.decision === "stage6_runtime_execution_contract_closed" &&
    source.stage6ContractClosed === true &&
    source.stage6ClosureOnly === true &&
    source.actualRuntimeExecutionAllowedAfterStage6 === false
  );
}

export function buildRuntimeImplementationPlanningItems(
  source: RuntimeExecutionContractClosureReport,
): readonly RuntimeImplementationPlanningItem[] {
  if (!sourceReadyForPlanningItems(source)) {
    return [];
  }

  return STAGE7_A_REQUIRED_PLANNING_ITEM_IDS.map((planningItemId) => {
    const spec = STAGE7_A_PLANNING_ITEM_SPECS[planningItemId];
    return {
      planningItemId,
      area: spec.area,
      title: spec.title,
      purpose: spec.purpose,
      recommendedPrType: spec.recommendedPrType,
      dependsOn: [...spec.dependsOn],
      requiredApprovals: [...spec.requiredApprovals],
      forbiddenInThisStep: [...spec.forbiddenInThisStep],
      candidateOnly: true as const,
      implementedInThisStep: false as const,
    };
  });
}

const EMPTY_VALIDATION: RuntimeImplementationPlanningValidationResult = {
  valid: true,
  missingPlanningItemIds: [],
  duplicatePlanningItemIds: [],
  invalidPrTypeItemIds: [],
  emptyApprovalItemIds: [],
  emptyForbiddenBoundaryItemIds: [],
  implementedInThisStepItemIds: [],
};

export function validateRuntimeImplementationPlanningItems(
  items: readonly RuntimeImplementationPlanningItem[],
): RuntimeImplementationPlanningValidationResult {
  if (items.length === 0) {
    return {
      valid: false,
      missingPlanningItemIds: [...STAGE7_A_REQUIRED_PLANNING_ITEM_IDS],
      duplicatePlanningItemIds: [],
      invalidPrTypeItemIds: [],
      emptyApprovalItemIds: [],
      emptyForbiddenBoundaryItemIds: [],
      implementedInThisStepItemIds: [],
    };
  }

  const missingPlanningItemIds: string[] = [];
  const duplicatePlanningItemIds: string[] = [];
  const invalidPrTypeItemIds: string[] = [];
  const emptyApprovalItemIds: string[] = [];
  const emptyForbiddenBoundaryItemIds: string[] = [];
  const implementedInThisStepItemIds: string[] = [];

  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.planningItemId)) {
      duplicatePlanningItemIds.push(item.planningItemId);
    } else {
      seen.add(item.planningItemId);
    }

    if (!VALID_PR_TYPES.has(item.recommendedPrType)) {
      invalidPrTypeItemIds.push(item.planningItemId);
    }
    if (item.requiredApprovals.length < 1) {
      emptyApprovalItemIds.push(item.planningItemId);
    }
    if (item.forbiddenInThisStep.length < 1) {
      emptyForbiddenBoundaryItemIds.push(item.planningItemId);
    }
    if (item.implementedInThisStep !== false) {
      implementedInThisStepItemIds.push(item.planningItemId);
    }
  }

  for (const requiredId of STAGE7_A_REQUIRED_PLANNING_ITEM_IDS) {
    if (!seen.has(requiredId)) {
      missingPlanningItemIds.push(requiredId);
    }
  }

  const valid =
    missingPlanningItemIds.length === 0 &&
    duplicatePlanningItemIds.length === 0 &&
    invalidPrTypeItemIds.length === 0 &&
    emptyApprovalItemIds.length === 0 &&
    emptyForbiddenBoundaryItemIds.length === 0 &&
    implementedInThisStepItemIds.length === 0;

  if (valid) {
    return EMPTY_VALIDATION;
  }

  return {
    valid: false,
    missingPlanningItemIds,
    duplicatePlanningItemIds,
    invalidPrTypeItemIds,
    emptyApprovalItemIds,
    emptyForbiddenBoundaryItemIds,
    implementedInThisStepItemIds,
  };
}

export function resolveRuntimeImplementationPlanningCandidateDecision(
  input: RuntimeImplementationPlanningCandidateDecisionInput,
): RuntimeImplementationPlanningCandidateDecision {
  if (input.sourceContractClosureDecision === "blocked") {
    return "blocked";
  }

  if (input.sourceContractClosureDecision === "defer") {
    return "defer";
  }

  if (input.sourceContractClosureDecision !== "stage6_runtime_execution_contract_closed") {
    return "defer";
  }

  if (
    input.sourceStage6ContractClosed !== true ||
    input.sourceStage6ClosureOnly !== true ||
    input.sourceActualRuntimeExecutionAllowedAfterStage6 !== false ||
    input.sourceActualRuntimeExecutionAllowedInThisStep !== false ||
    input.sourceActualExecutionRunnerAllowedInThisStep !== false ||
    input.sourceActualDryRunRunnerAllowedInThisStep !== false ||
    input.sourceActualExecutionWireAllowedInThisStep !== false ||
    input.sourceActualPersistenceAllowedInThisStep !== false ||
    input.sourceActualSchemaMigrationAllowedInThisStep !== false ||
    !input.planningItemsValid
  ) {
    return "blocked";
  }

  if (!input.confirmationsSatisfied) {
    return "defer";
  }

  return "ready_for_runtime_implementation_pr_planning";
}

export function buildRuntimeImplementationPlanningCandidateFingerprint(input: {
  readonly sourceContractClosureFingerprint: string;
  readonly planningItemCount: number;
  readonly confirmationCount: number;
  readonly separatedPrCandidateCount: number;
}): string {
  return [
    "runtime-implementation-planning-candidate-v1",
    input.sourceContractClosureFingerprint,
    `planningItems:${input.planningItemCount}`,
    `confirmations:${input.confirmationCount}`,
    `separatePr:${input.separatedPrCandidateCount}`,
  ].join("::");
}

export function buildRuntimeImplementationPlanningCandidateSummary(
  decision: RuntimeImplementationPlanningCandidateDecision,
): string {
  if (decision === "blocked") {
    return "Stage 7-A runtime implementation planning candidate is blocked.";
  }
  if (decision === "defer") {
    return "Stage 7-A planning candidate defers; Stage 6-F closure or confirmations are incomplete.";
  }
  return "Stage 6 contract chain is closed; implementation PR candidates are ready for planning review. Actual runtime implementation remains disallowed.";
}

type ChecklistEntry = {
  readonly item: string;
  readonly area: RuntimeImplementationPlanningCandidateChecklistItem["area"];
  readonly satisfied: boolean;
  readonly detail: string;
};

function mapChecklist(
  entries: readonly ChecklistEntry[],
): RuntimeImplementationPlanningCandidateChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    area: entry.area,
    satisfied: entry.satisfied,
    reason: `${entry.item}: ${entry.satisfied ? "satisfied" : "not satisfied"} — ${entry.detail}`,
  }));
}

export function buildRuntimeImplementationPlanningCandidateChecklists(input: {
  readonly parsed: ParsedRuntimeImplementationPlanningCandidateInput;
  readonly source: RuntimeExecutionContractClosureReport;
  readonly planningItemsValid: boolean;
  readonly planningItemCount: number;
  readonly separatedPrCandidateCount: number;
}): {
  readonly planningChecklist: readonly RuntimeImplementationPlanningCandidateChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeImplementationPlanningCandidateChecklistItem[];
  readonly approvalChecklist: readonly RuntimeImplementationPlanningCandidateChecklistItem[];
} {
  const sourceReady = input.source.decision === "stage6_runtime_execution_contract_closed";

  const planningChecklist = mapChecklist([
    {
      item: "stage6_contract_closure_ready",
      area: "implementation_planning",
      satisfied: sourceReady,
      detail: "Stage 6-F contract closure is ready",
    },
    {
      item: "planning_items_generated",
      area: "implementation_planning",
      satisfied: input.planningItemCount >= STAGE7_A_REQUIRED_PLANNING_ITEM_IDS.length,
      detail: `planningItemCount=${input.planningItemCount}`,
    },
    {
      item: "planning_items_validated",
      area: "implementation_planning",
      satisfied: input.planningItemsValid,
      detail: "planning items validation",
    },
    {
      item: "separate_pr_candidates_defined",
      area: "separated_work",
      satisfied: input.separatedPrCandidateCount > 0,
      detail: `separatedPrCandidateCount=${input.separatedPrCandidateCount}`,
    },
    {
      item: "rollback_planning_reviewed",
      area: "rollback",
      satisfied: input.parsed.runtimeImplementationRollbackPlanReviewed,
      detail: "runtimeImplementationRollbackPlanReviewed",
    },
  ]);

  const boundaryChecklist = mapChecklist([
    {
      item: "no_actual_runtime_execution",
      area: "runtime_api",
      satisfied: input.source.actualRuntimeExecutionAllowedInThisStep === false,
      detail: "actualRuntimeExecutionAllowedInThisStep=false",
    },
    {
      item: "no_actual_execution_runner",
      area: "execution_runner",
      satisfied: input.source.actualExecutionRunnerAllowedInThisStep === false,
      detail: "actualExecutionRunnerAllowedInThisStep=false",
    },
    {
      item: "no_actual_dry_run_runner",
      area: "dry_run_runner",
      satisfied: input.source.actualDryRunRunnerAllowedInThisStep === false,
      detail: "actualDryRunRunnerAllowedInThisStep=false",
    },
    {
      item: "no_actual_persistence",
      area: "persistence",
      satisfied: input.source.actualPersistenceAllowedInThisStep === false,
      detail: "actualPersistenceAllowedInThisStep=false",
    },
    {
      item: "no_actual_schema_migration",
      area: "schema_migration",
      satisfied: input.source.actualSchemaMigrationAllowedInThisStep === false,
      detail: "actualSchemaMigrationAllowedInThisStep=false",
    },
    {
      item: "no_cursor_github_wire",
      area: "cursor_github_wire",
      satisfied: input.source.actualCursorGithubWireAllowedInThisStep === false,
      detail: "actualCursorGithubWireAllowedInThisStep=false",
    },
    {
      item: "no_connector_routing_change",
      area: "connector_gateway_routing",
      satisfied: input.source.actualConnectorRoutingChangeAllowedInThisStep === false,
      detail: "actualConnectorRoutingChangeAllowedInThisStep=false",
    },
    {
      item: "no_ui_implementation",
      area: "ui",
      satisfied: true,
      detail: "actualUiImplementationAllowedInThisStep=false",
    },
  ]);

  const approvalChecklist = mapChecklist([
    {
      item: "operator_approval_required",
      area: "approval",
      satisfied: input.parsed.runtimeImplementationOperatorApprovalRequiredConfirmed,
      detail: "runtimeImplementationOperatorApprovalRequiredConfirmed",
    },
    {
      item: "implementation_requires_separate_pr",
      area: "separated_work",
      satisfied: input.parsed.runtimeImplementationSeparatePrConfirmed,
      detail: "runtimeImplementationSeparatePrConfirmed",
    },
    {
      item: "schema_migration_requires_separate_approval",
      area: "schema_migration",
      satisfied: sourceReady,
      detail: "schema migration approval PR planned",
    },
    {
      item: "persistence_requires_separate_approval",
      area: "persistence",
      satisfied: sourceReady,
      detail: "persistence design PR planned",
    },
  ]);

  return { planningChecklist, boundaryChecklist, approvalChecklist };
}

export function appendRuntimeImplementationPlanningCandidateFindings(input: {
  readonly findings: RuntimeImplementationPlanningCandidateFinding[];
  readonly decision: RuntimeImplementationPlanningCandidateDecision;
  readonly source: RuntimeExecutionContractClosureReport;
  readonly parsed: ParsedRuntimeImplementationPlanningCandidateInput;
  readonly planningValidation: RuntimeImplementationPlanningValidationResult;
}): void {
  const { findings, decision, source, parsed, planningValidation } = input;

  findings.push(
    finding("info", "runtime_implementation_planning_candidate_created", "Stage 7-A planning candidate evaluator created"),
  );
  findings.push(
    finding(
      "info",
      "runtime_implementation_planning_candidate_only",
      "Stage 7-A remains planning-only; no implementation permission",
    ),
  );

  if (source.decision === "blocked") {
    findings.push(finding("blocking", "source_stage6_contract_closure_blocked", "Source Stage 6-F contract closure is blocked"));
    findings.push(finding("blocking", "stage7_a_planning_candidate_blocked", "Stage 7-A planning candidate is blocked"));
    return;
  }

  if (source.decision === "defer" || source.decision !== "stage6_runtime_execution_contract_closed") {
    findings.push(
      finding("warning", "source_stage6_contract_closure_not_ready", "Source Stage 6-F contract closure is not ready"),
    );
    if (!parsed.runtimeImplementationPlanningReviewed) {
      findings.push(finding("warning", "stage7_a_planning_candidate_deferred", "runtimeImplementationPlanningReviewed is missing"));
    }
    if (!parsed.runtimeImplementationSeparatePrConfirmed) {
      findings.push(finding("warning", "stage7_a_planning_candidate_deferred", "runtimeImplementationSeparatePrConfirmed is missing"));
    }
    if (!parsed.runtimeImplementationNoActualExecutionConfirmed) {
      findings.push(finding("warning", "stage7_a_planning_candidate_deferred", "runtimeImplementationNoActualExecutionConfirmed is missing"));
    }
    if (!parsed.runtimeImplementationRollbackPlanReviewed) {
      findings.push(finding("warning", "stage7_a_planning_candidate_deferred", "runtimeImplementationRollbackPlanReviewed is missing"));
    }
    if (!parsed.runtimeImplementationOperatorApprovalRequiredConfirmed) {
      findings.push(
        finding("warning", "stage7_a_planning_candidate_deferred", "runtimeImplementationOperatorApprovalRequiredConfirmed is missing"),
      );
    }
    findings.push(finding("warning", "stage7_a_planning_candidate_deferred", "Stage 7-A planning candidate defers"));
    return;
  }

  if (
    !source.stage6ContractClosed ||
    !source.stage6ClosureOnly ||
    source.actualRuntimeExecutionAllowedAfterStage6 !== false ||
    source.actualRuntimeExecutionAllowedInThisStep !== false ||
    source.actualExecutionRunnerAllowedInThisStep !== false ||
    source.actualDryRunRunnerAllowedInThisStep !== false ||
    source.actualExecutionWireAllowedInThisStep !== false ||
    source.actualPersistenceAllowedInThisStep !== false ||
    source.actualSchemaMigrationAllowedInThisStep !== false ||
    !planningValidation.valid
  ) {
    if (!planningValidation.valid) {
      findings.push(finding("blocking", "planning_items_validation_failed", "Planning items validation failed"));
    }
    findings.push(finding("blocking", "stage7_a_planning_candidate_blocked", "Stage 7-A planning candidate is blocked"));
    return;
  }

  findings.push(finding("info", "source_stage6_closure_trace_copied", "Stage 6-F closure trace copied into planning candidate report"));
  findings.push(finding("info", "planning_items_validation_passed", "All required planning items validated"));
  findings.push(finding("info", "actual_runtime_execution_still_disallowed", "Actual runtime execution remains disallowed in Stage 7-A"));
  findings.push(finding("info", "actual_runner_still_disallowed", "Actual execution runner remains disallowed in Stage 7-A"));
  findings.push(finding("info", "actual_dry_run_runner_still_disallowed", "Actual dry-run runner remains disallowed in Stage 7-A"));
  findings.push(finding("info", "actual_persistence_still_disallowed", "Actual persistence remains disallowed in Stage 7-A"));
  findings.push(finding("info", "actual_schema_migration_still_disallowed", "Actual schema migration remains disallowed in Stage 7-A"));
  findings.push(finding("info", "separate_pr_planning_required", "Implementation work must be split into separate PRs"));
  findings.push(
    finding("info", "operator_approval_required_before_implementation", "Operator approval is required before any implementation PR"),
  );
  if (decision === "ready_for_runtime_implementation_pr_planning") {
    findings.push(finding("info", "stage7_a_planning_candidate_ready", "Stage 7-A planning candidate is ready for implementation PR planning"));
  }
}

/** Evaluate source Stage 6-F report for implementation planning. */
export function evaluateRuntimeImplementationPlanningCandidateSource(
  input?: RuntimeImplementationPlanningCandidateInput,
): RuntimeExecutionContractClosureReport {
  return evaluateRuntimeExecutionContractClosure(input?.contractClosure);
}

export {
  REQUIRED_STAGE7_A_IMPLEMENTATION_PLANNING_CONFIRMATIONS,
  RUNTIME_IMPLEMENTATION_PLANNING_CANDIDATE_TITLE,
  RUNTIME_IMPLEMENTATION_PLANNING_CANDIDATE_VERSION,
  STAGE7_A_RECOMMENDED_NEXT_PHASES,
  STAGE7_A_SEPARATED_WORK_ITEMS,
};
