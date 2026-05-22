/**
 * Stage 6-D contract candidate builders (read-only).
 */

import { buildDefaultRuntimeExecutionModelCandidates } from "@/lib/agents/evaluateRuntimeExecutionModelCandidate";
import type { RuntimeExecutionModelReviewGateReport } from "@/lib/agents/runtimeExecutionModelReviewGateTypes";
import {
  COMMON_CONTRACT_BOUNDARY_RULES,
  REQUIRED_RUNTIME_EXECUTION_CONTRACT_IDS,
  RUNTIME_EXECUTION_MODEL_KIND_TO_CONTRACT,
} from "@/lib/agents/runtimeExecutionContractCandidateConstants";
import type {
  RuntimeExecutionContractCandidateItem,
  RuntimeExecutionContractCandidateValidationResult,
} from "@/lib/agents/runtimeExecutionContractCandidateTypes";

function sourceReadyForContractCandidates(source: RuntimeExecutionModelReviewGateReport): boolean {
  return (
    source.decision === "ready_for_runtime_execution_contract_candidate" &&
    source.reviewGateOnly === true &&
    source.sourceCandidateOnly === true &&
    source.sourceNoRunBoundarySatisfied === true &&
    source.sourcePersistenceBoundarySatisfied === true &&
    source.schemaMigrationBoundarySatisfied === true &&
    source.forbiddenFieldDetected !== true
  );
}

export function buildRuntimeExecutionContractCandidates(
  source: RuntimeExecutionModelReviewGateReport,
): readonly RuntimeExecutionContractCandidateItem[] {
  if (!sourceReadyForContractCandidates(source)) {
    return [];
  }

  const reviewedKinds = new Set(source.reviewedModelKinds);
  const models = buildDefaultRuntimeExecutionModelCandidates().filter((model) =>
    reviewedKinds.has(model.kind),
  );

  return models.map((model) => {
    const spec = RUNTIME_EXECUTION_MODEL_KIND_TO_CONTRACT[model.kind];
    return {
      contractId: spec.contractId,
      area: spec.area,
      modelKind: model.kind,
      contractName: spec.contractName,
      purpose: `Defines ${spec.area.replace(/_/g, " ")} candidate for future runtime execution.`,
      requiredFields: [...model.proposedFields],
      optionalFields: [],
      boundaryRules: [...COMMON_CONTRACT_BOUNDARY_RULES, ...spec.extraBoundaryRules],
      candidateOnly: true,
      implementedInThisStep: false,
    };
  });
}

const EMPTY_VALIDATION: RuntimeExecutionContractCandidateValidationResult = {
  valid: true,
  missingContractIds: [],
  duplicateContractIds: [],
  emptyRequiredFieldContractIds: [],
  invalidBoundaryRuleContractIds: [],
  implementedInThisStepContractIds: [],
};

export function validateRuntimeExecutionContractCandidateDetails(
  candidates: readonly RuntimeExecutionContractCandidateItem[],
): RuntimeExecutionContractCandidateValidationResult {
  const missingContractIds: string[] = [];
  const duplicateContractIds: string[] = [];
  const emptyRequiredFieldContractIds: string[] = [];
  const invalidBoundaryRuleContractIds: string[] = [];
  const implementedInThisStepContractIds: string[] = [];

  const idCounts = new Map<string, number>();
  for (const candidate of candidates) {
    idCounts.set(candidate.contractId, (idCounts.get(candidate.contractId) ?? 0) + 1);
  }

  for (const requiredId of REQUIRED_RUNTIME_EXECUTION_CONTRACT_IDS) {
    if (!idCounts.has(requiredId)) {
      missingContractIds.push(requiredId);
    }
  }

  for (const [contractId, count] of idCounts) {
    if (count > 1) {
      duplicateContractIds.push(contractId);
    }
  }

  for (const candidate of candidates) {
    if (candidate.requiredFields.length === 0) {
      emptyRequiredFieldContractIds.push(candidate.contractId);
    }
    if (candidate.boundaryRules.length < 2) {
      invalidBoundaryRuleContractIds.push(candidate.contractId);
    }
    if (candidate.candidateOnly !== true) {
      invalidBoundaryRuleContractIds.push(candidate.contractId);
    }
    if (candidate.implementedInThisStep !== false) {
      implementedInThisStepContractIds.push(candidate.contractId);
    }
  }

  const valid =
    candidates.length === REQUIRED_RUNTIME_EXECUTION_CONTRACT_IDS.length &&
    missingContractIds.length === 0 &&
    duplicateContractIds.length === 0 &&
    emptyRequiredFieldContractIds.length === 0 &&
    invalidBoundaryRuleContractIds.length === 0 &&
    implementedInThisStepContractIds.length === 0;

  if (valid) {
    return EMPTY_VALIDATION;
  }

  return {
    valid: false,
    missingContractIds,
    duplicateContractIds,
    emptyRequiredFieldContractIds,
    invalidBoundaryRuleContractIds,
    implementedInThisStepContractIds,
  };
}

export function validateRuntimeExecutionContractCandidates(
  candidates: readonly RuntimeExecutionContractCandidateItem[],
): boolean {
  return validateRuntimeExecutionContractCandidateDetails(candidates).valid;
}
