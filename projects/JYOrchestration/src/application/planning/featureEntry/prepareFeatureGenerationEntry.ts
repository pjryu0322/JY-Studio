/**
 * Application bridge: requirement input or refinement bundle → feature-generation entry gate.
 */

import type { RequirementInputRequest } from "../requirementInput/requirementInputContracts";
import { prepareRequirementRefinementDecision, type PrepareRequirementRefinementDecisionResult } from "../requirementInput/prepareRequirementRefinementDecision";
import { buildFeatureGenerationDecision, type BuildFeatureGenerationDecisionInput } from "./buildFeatureGenerationDecision";
import type { FeatureGenerationDecision, FeatureGenerationEntryResult } from "./featureEntryContracts";

export type PrepareFeatureGenerationEntryRequest =
  | ({ source: "requirement_input" } & RequirementInputRequest)
  | { source: "refinement_result"; refinement: PrepareRequirementRefinementDecisionResult };

export type PrepareFeatureGenerationEntryResult = PrepareRequirementRefinementDecisionResult & {
  featureGenerationDecision: FeatureGenerationDecision;
  featureGenerationEntry: FeatureGenerationEntryResult;
};

function refinementBundleFromRequest(request: PrepareFeatureGenerationEntryRequest): PrepareRequirementRefinementDecisionResult {
  if (request.source === "requirement_input") {
    return prepareRequirementRefinementDecision({
      projectId: request.projectId,
      inputText: request.inputText,
    });
  }
  return request.refinement;
}

/**
 * Runs refinement when needed, evaluates readiness, and returns the entry gate result for downstream Feature work.
 */
export function prepareFeatureGenerationEntry(
  request: PrepareFeatureGenerationEntryRequest
): PrepareFeatureGenerationEntryResult {
  const refinement = refinementBundleFromRequest(request);
  const gateInput: BuildFeatureGenerationDecisionInput = {
    refinementDecision: refinement.refinementDecision,
    readinessResult: refinement.readinessResult,
    refinedRequirements: refinement.refinedRequirements,
  };
  const { decision, entry } = buildFeatureGenerationDecision(gateInput);
  return {
    ...refinement,
    featureGenerationDecision: decision,
    featureGenerationEntry: entry,
  };
}
