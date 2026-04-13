/**
 * Bridge: Requirement Input planning → `MvpRequirement[]` for the existing MVP domain pipeline.
 *
 * Downstream Feature / IA / Screen / Task generators are unchanged; only the source of requirements differs.
 */

import type { MvpRequirement } from "../../../mvp/domain/mvpDomainTypes";
import type { PrepareRequirementsFromInputResult, RequirementInputRequest } from "./requirementInputContracts";
import { buildRequirementDrafts } from "./buildRequirementDrafts";

/**
 * Full flow: normalize → split → gaps → draft rows → compatible `MvpRequirement` entities.
 */
export function prepareRequirementsFromInput(request: RequirementInputRequest): PrepareRequirementsFromInputResult {
  const draftResult = buildRequirementDrafts(request);
  const requirements: MvpRequirement[] = draftResult.drafts.map((d, i) => ({
    id: `req-${request.projectId}-plan-${i}`,
    projectId: request.projectId,
    description: d.description,
    status: "CONFIRMED",
  }));
  return { draftResult, requirements };
}
