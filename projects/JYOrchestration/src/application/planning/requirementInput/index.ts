/**
 * Requirement Input UX — user idea → normalized input → drafts + gaps → `MvpRequirement[]`.
 */

export type {
  RequirementInputRequest,
  RequirementInputNormalized,
  RequirementDraft,
  RequirementGap,
  RequirementDraftResult,
  PrepareRequirementsFromInputResult,
} from "./requirementInputContracts";
export { normalizeRequirementInput } from "./normalizeRequirementInput";
export { splitRequirementInput } from "./splitRequirementInput";
export { detectRequirementGaps } from "./detectRequirementGaps";
export { buildRequirementDrafts } from "./buildRequirementDrafts";
export { prepareRequirementsFromInput } from "./prepareRequirementsFromInput";
export { prepareRequirementInputForRefinement, type PrepareRequirementInputForRefinementResult } from "./prepareRequirementInputForRefinement";
export {
  prepareRequirementRefinementDecision,
  type PrepareRequirementRefinementDecisionResult,
} from "./prepareRequirementRefinementDecision";
export * from "./gapUx";
export * from "./refinement";
