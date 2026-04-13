/**
 * Build the full refinement decision (classify → auto-resolve stubs).
 */

import type { RequirementDraft, RequirementGap } from "../requirementInputContracts";
import type { RequirementRefinementDecision } from "./refinementContracts";
import { autoResolveRequirementGaps } from "./autoResolveRequirementGaps";
import { classifyRequirementGaps } from "./classifyRequirementGaps";

export type BuildRefinementDecisionInput = {
  normalizedText: string;
  drafts: readonly RequirementDraft[];
  gaps: readonly RequirementGap[];
};

export function buildRefinementDecision(input: BuildRefinementDecisionInput): RequirementRefinementDecision {
  const classified = classifyRequirementGaps(input.gaps, input.drafts, input.normalizedText);
  const decisions = autoResolveRequirementGaps(classified, input.drafts);
  return {
    normalizedText: input.normalizedText,
    drafts: [...input.drafts],
    decisions,
  };
}
