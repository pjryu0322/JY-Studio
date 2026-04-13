/**
 * Future handoff: drafts + gap UX + refinement decisions + readiness before Feature generation.
 */

import type { RequirementDraft, RequirementInputRequest } from "./requirementInputContracts";
import type { RequirementGapViewModel } from "./gapUx/gapUxContracts";
import { buildRequirementDrafts } from "./buildRequirementDrafts";
import { buildRequirementGapViewModel } from "./gapUx/buildRequirementGapViewModel";
import { buildRefinementDecision } from "./refinement/buildRefinementDecision";
import { buildRefinedRequirements } from "./refinement/buildRefinedRequirements";
import { evaluateRequirementReadiness } from "./refinement/evaluateRequirementReadiness";
import type {
  RefinedRequirement,
  RequirementReadinessResult,
  RequirementRefinementDecision,
} from "./refinement/refinementContracts";

export type PrepareRequirementRefinementDecisionResult = {
  normalizedText: string;
  drafts: RequirementDraft[];
  gapViewModel: RequirementGapViewModel;
  refinementDecision: RequirementRefinementDecision;
  refinedRequirements: RefinedRequirement[];
  readinessResult: RequirementReadinessResult;
};

export function prepareRequirementRefinementDecision(
  request: RequirementInputRequest
): PrepareRequirementRefinementDecisionResult {
  const draftResult = buildRequirementDrafts(request);
  const gapViewModel = buildRequirementGapViewModel({
    normalizedText: draftResult.normalizedText,
    drafts: draftResult.drafts,
    gaps: draftResult.gaps,
  });
  const refinementDecision = buildRefinementDecision({
    normalizedText: draftResult.normalizedText,
    drafts: draftResult.drafts,
    gaps: draftResult.gaps,
  });
  const refinedRequirements = buildRefinedRequirements({ refinementDecision });
  const readinessResult = evaluateRequirementReadiness(refinementDecision);
  return {
    normalizedText: draftResult.normalizedText,
    drafts: draftResult.drafts,
    gapViewModel,
    refinementDecision,
    refinedRequirements,
    readinessResult,
  };
}
