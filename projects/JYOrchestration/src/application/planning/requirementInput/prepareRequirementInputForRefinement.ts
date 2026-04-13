/**
 * Future UX handoff: full planning bundle including grouped/prioritized gap view model + requirements.
 *
 * Downstream Feature → IA → Screen → Task is unchanged; this only prepares structured data.
 */

import type { MvpRequirement } from "../../../mvp/domain/mvpDomainTypes";
import type { RequirementDraft, RequirementInputRequest } from "./requirementInputContracts";
import { buildRequirementDrafts } from "./buildRequirementDrafts";
import { buildRequirementGapViewModel } from "./gapUx/buildRequirementGapViewModel";
import type { RequirementGapViewModel } from "./gapUx/gapUxContracts";

export type PrepareRequirementInputForRefinementResult = {
  normalizedText: string;
  drafts: RequirementDraft[];
  gapViewModel: RequirementGapViewModel;
  /** Optional but included for immediate pipeline use after refinement. */
  requirements: MvpRequirement[];
};

export function prepareRequirementInputForRefinement(
  request: RequirementInputRequest
): PrepareRequirementInputForRefinementResult {
  const draftResult = buildRequirementDrafts(request);
  const gapViewModel = buildRequirementGapViewModel({
    normalizedText: draftResult.normalizedText,
    drafts: draftResult.drafts,
    gaps: draftResult.gaps,
  });
  const requirements: MvpRequirement[] = draftResult.drafts.map((d, i) => ({
    id: `req-${request.projectId}-plan-${i}`,
    projectId: request.projectId,
    description: d.description,
    status: "CONFIRMED",
  }));
  return {
    normalizedText: draftResult.normalizedText,
    drafts: draftResult.drafts,
    gapViewModel,
    requirements,
  };
}
