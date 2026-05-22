/**
 * Stage 6-C runtime execution model review gate support (read-only).
 */

import { evaluateRuntimeExecutionModelCandidate } from "@/lib/agents/evaluateRuntimeExecutionModelCandidate";
import type { RuntimeExecutionModelCandidateReport } from "@/lib/agents/runtimeExecutionModelCandidateTypes";
import type { RuntimeExecutionModelCandidateKind } from "@/lib/agents/runtimeExecutionModelCandidateTypes";
import {
  collectForbiddenFieldTraceInModelCandidates,
  computeNoRunBoundarySatisfied,
  computePersistenceBoundarySatisfied,
  computeReviewedModelTrace,
  detectForbiddenFieldsInModelCandidates,
} from "@/lib/agents/runtimeExecutionModelReviewGateBoundary";

export {
  collectForbiddenFieldTraceInModelCandidates,
  computeNoRunBoundarySatisfied,
  computePersistenceBoundarySatisfied,
  computeReviewedModelTrace,
  detectForbiddenFieldsInModelCandidates,
} from "@/lib/agents/runtimeExecutionModelReviewGateBoundary";

export { buildRuntimeExecutionModelReviewGateChecklists } from "@/lib/agents/runtimeExecutionModelReviewGateChecklists";
export { appendRuntimeExecutionModelReviewGateFindings } from "@/lib/agents/runtimeExecutionModelReviewGateFindings";

export {
  REQUIRED_STAGE6_C_MODEL_REVIEW_GATE_CONFIRMATIONS,
  RUNTIME_EXECUTION_MODEL_REVIEW_GATE_TITLE,
  RUNTIME_EXECUTION_MODEL_REVIEW_GATE_VERSION,
  SCHEMA_MIGRATION_BOUNDARY_SATISFIED,
  STAGE6_C_RECOMMENDED_NEXT_PHASES,
  STAGE6_C_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/runtimeExecutionModelReviewGateConstants";

import type {
  ParsedRuntimeExecutionModelReviewGateInput,
  RuntimeExecutionModelReviewGateDecision,
  RuntimeExecutionModelReviewGateDecisionInput,
  RuntimeExecutionModelReviewGateInput,
} from "@/lib/agents/runtimeExecutionModelReviewGateTypes";

export function parseRuntimeExecutionModelReviewGateInput(
  input?: RuntimeExecutionModelReviewGateInput,
): ParsedRuntimeExecutionModelReviewGateInput {
  const flags = [
    input?.runtimeModelReviewGateConfirmed === true,
    input?.runtimeModelFieldContractReviewed === true,
    input?.runtimeModelNoRunBoundaryReviewed === true,
    input?.runtimeModelPersistenceBoundaryReviewed === true,
    input?.runtimeModelApprovalBoundaryReviewed === true,
  ];
  return {
    runtimeModelReviewGateConfirmed: flags[0],
    runtimeModelFieldContractReviewed: flags[1],
    runtimeModelNoRunBoundaryReviewed: flags[2],
    runtimeModelPersistenceBoundaryReviewed: flags[3],
    runtimeModelApprovalBoundaryReviewed: flags[4],
    confirmationsSatisfied: flags.every(Boolean),
    confirmationCount: flags.filter(Boolean).length,
  };
}

export function resolveRuntimeExecutionModelReviewGateDecision(
  input: RuntimeExecutionModelReviewGateDecisionInput,
): RuntimeExecutionModelReviewGateDecision {
  if (input.sourceModelCandidateDecision === "blocked") {
    return "blocked";
  }

  if (
    input.sourceCandidateOnly !== true ||
    input.forbiddenFieldDetected ||
    input.noRunBoundarySatisfied !== true ||
    input.persistenceBoundarySatisfied !== true ||
    input.schemaMigrationBoundarySatisfied !== true
  ) {
    return "blocked";
  }

  if (
    input.sourceModelCandidateDecision === "defer" ||
    input.sourceModelCandidateDecision !== "ready_for_runtime_execution_model_review" ||
    !input.confirmationsSatisfied
  ) {
    return "defer";
  }

  return "ready_for_runtime_execution_contract_candidate";
}

export function buildRuntimeExecutionModelReviewGateFingerprint(input: {
  readonly sourceModelCandidateFingerprint: string;
  readonly reviewedModelKinds: readonly RuntimeExecutionModelCandidateKind[];
  readonly reviewedFieldCount: number;
  readonly confirmationCount: number;
  readonly sourceCandidateOnly: boolean;
  readonly sourceNoRunBoundarySatisfied: boolean;
  readonly sourcePersistenceBoundarySatisfied: boolean;
  readonly forbiddenFieldDetected: boolean;
}): string {
  return [
    "runtime-execution-model-review-gate-v1",
    input.sourceModelCandidateFingerprint,
    input.reviewedModelKinds.join("|"),
    `fields:${input.reviewedFieldCount}`,
    `confirmations:${input.confirmationCount}`,
    `candidateOnly:${input.sourceCandidateOnly}`,
    `noRun:${input.sourceNoRunBoundarySatisfied}`,
    `persistence:${input.sourcePersistenceBoundarySatisfied}`,
    `forbidden:${input.forbiddenFieldDetected}`,
  ].join("::");
}

export function buildRuntimeExecutionModelReviewGateSummary(
  decision: RuntimeExecutionModelReviewGateDecision,
): string {
  if (decision === "blocked") {
    return "Stage 6-C runtime execution model review gate is blocked.";
  }
  if (decision === "defer") {
    return "Stage 6-C runtime execution model review gate defers; source candidate or confirmations are incomplete.";
  }
  return "Stage 6-C review gate is ready for runtime execution contract candidate. This is not actual runtime execution permission.";
}

/** Evaluate source Stage 6-B report for review gate (used by evaluator). */
export function evaluateRuntimeExecutionModelReviewGateSource(
  input?: RuntimeExecutionModelReviewGateInput,
): RuntimeExecutionModelCandidateReport {
  return evaluateRuntimeExecutionModelCandidate(input?.modelCandidate);
}
