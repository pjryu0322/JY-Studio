/**
 * Stage 6-D runtime execution contract candidate support (read-only).
 */

import { evaluateRuntimeExecutionModelReviewGate } from "@/lib/agents/evaluateRuntimeExecutionModelReviewGate";
import type { RuntimeExecutionModelReviewGateReport } from "@/lib/agents/runtimeExecutionModelReviewGateTypes";
import {
  buildRuntimeExecutionContractCandidates,
  validateRuntimeExecutionContractCandidateDetails,
  validateRuntimeExecutionContractCandidates,
} from "@/lib/agents/runtimeExecutionContractCandidateContracts";
import { buildRuntimeExecutionContractCandidateChecklists } from "@/lib/agents/runtimeExecutionContractCandidateChecklists";
import { appendRuntimeExecutionContractCandidateFindings } from "@/lib/agents/runtimeExecutionContractCandidateFindings";

export {
  buildRuntimeExecutionContractCandidates,
  validateRuntimeExecutionContractCandidateDetails,
  validateRuntimeExecutionContractCandidates,
} from "@/lib/agents/runtimeExecutionContractCandidateContracts";

export { buildRuntimeExecutionContractCandidateChecklists } from "@/lib/agents/runtimeExecutionContractCandidateChecklists";
export { appendRuntimeExecutionContractCandidateFindings } from "@/lib/agents/runtimeExecutionContractCandidateFindings";

export {
  REQUIRED_STAGE6_D_CONTRACT_CANDIDATE_CONFIRMATIONS,
  RUNTIME_EXECUTION_CONTRACT_CANDIDATE_TITLE,
  RUNTIME_EXECUTION_CONTRACT_CANDIDATE_VERSION,
  STAGE6_D_RECOMMENDED_NEXT_PHASES,
  STAGE6_D_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/runtimeExecutionContractCandidateConstants";

import type {
  ParsedRuntimeExecutionContractCandidateInput,
  RuntimeExecutionContractCandidateDecision,
  RuntimeExecutionContractCandidateDecisionInput,
  RuntimeExecutionContractCandidateInput,
  RuntimeExecutionContractCandidateItem,
} from "@/lib/agents/runtimeExecutionContractCandidateTypes";

export function parseRuntimeExecutionContractCandidateInput(
  input?: RuntimeExecutionContractCandidateInput,
): ParsedRuntimeExecutionContractCandidateInput {
  const flags = [
    input?.runtimeExecutionContractCandidateConfirmed === true,
    input?.runtimeExecutionBoundaryContractReviewed === true,
    input?.runtimeExecutionDryRunContractReviewed === true,
    input?.runtimeExecutionRollbackContractReviewed === true,
    input?.runtimeExecutionApprovalContractReviewed === true,
  ];
  return {
    runtimeExecutionContractCandidateConfirmed: flags[0],
    runtimeExecutionBoundaryContractReviewed: flags[1],
    runtimeExecutionDryRunContractReviewed: flags[2],
    runtimeExecutionRollbackContractReviewed: flags[3],
    runtimeExecutionApprovalContractReviewed: flags[4],
    confirmationsSatisfied: flags.every(Boolean),
    confirmationCount: flags.filter(Boolean).length,
  };
}

export function computeRuntimeExecutionContractCandidateTrace(
  candidates: readonly RuntimeExecutionContractCandidateItem[],
  source: RuntimeExecutionModelReviewGateReport,
): {
  readonly contractCandidateCount: number;
  readonly contractFieldCount: number;
  readonly contractBoundaryRuleCount: number;
  readonly reviewedModelCount: number;
  readonly sourceReviewedModelCount: number;
  readonly sourceReviewedFieldCount: number;
  readonly sourceForbiddenFieldDetected: boolean;
  readonly sourceNoRunBoundarySatisfied: boolean;
  readonly sourcePersistenceBoundarySatisfied: boolean;
  readonly sourceSchemaMigrationBoundarySatisfied: boolean;
} {
  return {
    contractCandidateCount: candidates.length,
    contractFieldCount: candidates.reduce(
      (sum, c) => sum + c.requiredFields.length + c.optionalFields.length,
      0,
    ),
    contractBoundaryRuleCount: candidates.reduce((sum, c) => sum + c.boundaryRules.length, 0),
    reviewedModelCount: source.reviewedModelCount,
    sourceReviewedModelCount: source.reviewedModelCount,
    sourceReviewedFieldCount: source.reviewedFieldCount,
    sourceForbiddenFieldDetected: source.forbiddenFieldDetected,
    sourceNoRunBoundarySatisfied: source.sourceNoRunBoundarySatisfied,
    sourcePersistenceBoundarySatisfied: source.sourcePersistenceBoundarySatisfied,
    sourceSchemaMigrationBoundarySatisfied: source.schemaMigrationBoundarySatisfied,
  };
}

export function resolveRuntimeExecutionContractCandidateDecision(
  input: RuntimeExecutionContractCandidateDecisionInput,
): RuntimeExecutionContractCandidateDecision {
  if (input.sourceReviewGateDecision === "blocked") {
    return "blocked";
  }

  if (input.sourceReviewGateDecision === "defer") {
    return "defer";
  }

  if (input.sourceReviewGateDecision !== "ready_for_runtime_execution_contract_candidate") {
    return "defer";
  }

  if (
    input.sourceReviewGateOnly !== true ||
    input.sourceCandidateOnly !== true ||
    input.sourceNoRunBoundarySatisfied !== true ||
    input.sourcePersistenceBoundarySatisfied !== true ||
    input.sourceSchemaMigrationBoundarySatisfied !== true ||
    input.sourceForbiddenFieldDetected === true ||
    input.sourceActualExecutionWireAllowedInThisStep !== false ||
    input.sourceActualPersistenceAllowedInThisStep !== false ||
    input.sourceActualExternalSideEffectAllowedInThisStep !== false ||
    input.sourceActualSchemaMigrationAllowedInThisStep !== false ||
    input.sourceReviewedModelCount < 7 ||
    !input.contractCandidatesValid
  ) {
    return "blocked";
  }

  if (!input.confirmationsSatisfied) {
    return "defer";
  }

  return "ready_for_runtime_execution_dry_run_contract";
}

export function buildRuntimeExecutionContractCandidateFingerprint(input: {
  readonly sourceReviewGateFingerprint: string;
  readonly contractCandidateCount: number;
  readonly contractFieldCount: number;
  readonly contractBoundaryRuleCount: number;
  readonly confirmationCount: number;
  readonly sourceReviewedModelCount: number;
  readonly sourceReviewedFieldCount: number;
  readonly sourceForbiddenFieldDetected: boolean;
  readonly sourceNoRunBoundarySatisfied: boolean;
  readonly sourcePersistenceBoundarySatisfied: boolean;
  readonly sourceSchemaMigrationBoundarySatisfied: boolean;
}): string {
  return [
    "runtime-execution-contract-candidate-v1",
    input.sourceReviewGateFingerprint,
    `contracts:${input.contractCandidateCount}`,
    `fields:${input.contractFieldCount}`,
    `rules:${input.contractBoundaryRuleCount}`,
    `confirmations:${input.confirmationCount}`,
    `sourceModels:${input.sourceReviewedModelCount}`,
    `sourceFields:${input.sourceReviewedFieldCount}`,
    `sourceForbidden:${input.sourceForbiddenFieldDetected}`,
    `noRun:${input.sourceNoRunBoundarySatisfied}`,
    `persistence:${input.sourcePersistenceBoundarySatisfied}`,
    `schema:${input.sourceSchemaMigrationBoundarySatisfied}`,
  ].join("::");
}

export function buildRuntimeExecutionContractCandidateSummary(
  decision: RuntimeExecutionContractCandidateDecision,
): string {
  if (decision === "blocked") {
    return "Stage 6-D runtime execution contract candidate is blocked.";
  }
  if (decision === "defer") {
    return "Stage 6-D runtime execution contract candidate defers; review gate or confirmations are incomplete.";
  }
  return "Stage 6-D contract candidates are ready for dry-run contract design. This is not actual runtime execution.";
}

/** Evaluate source Stage 6-C report for contract candidate. */
export function evaluateRuntimeExecutionContractCandidateSource(
  input?: RuntimeExecutionContractCandidateInput,
): RuntimeExecutionModelReviewGateReport {
  return evaluateRuntimeExecutionModelReviewGate(input?.reviewGate);
}
