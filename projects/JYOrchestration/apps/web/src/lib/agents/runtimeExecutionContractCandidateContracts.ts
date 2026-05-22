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
import type { RuntimeExecutionContractCandidateItem } from "@/lib/agents/runtimeExecutionContractCandidateTypes";

export function buildRuntimeExecutionContractCandidates(
  _source: RuntimeExecutionModelReviewGateReport,
): readonly RuntimeExecutionContractCandidateItem[] {
  const models = buildDefaultRuntimeExecutionModelCandidates();
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

export function validateRuntimeExecutionContractCandidates(
  candidates: readonly RuntimeExecutionContractCandidateItem[],
): boolean {
  if (candidates.length !== REQUIRED_RUNTIME_EXECUTION_CONTRACT_IDS.length) {
    return false;
  }
  const ids = new Set(candidates.map((c) => c.contractId));
  if (!REQUIRED_RUNTIME_EXECUTION_CONTRACT_IDS.every((id) => ids.has(id))) {
    return false;
  }
  return candidates.every(
    (c) =>
      c.candidateOnly === true &&
      c.implementedInThisStep === false &&
      c.requiredFields.length > 0 &&
      c.boundaryRules.length > 0,
  );
}
