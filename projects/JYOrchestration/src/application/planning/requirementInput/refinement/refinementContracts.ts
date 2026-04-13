/**
 * Requirement refinement — decision layer before Feature generation (no UI / no HTTP).
 */

import type { RequirementDraft, RequirementGap } from "../requirementInputContracts";

export type RequirementGapResolutionMode = "AUTO" | "USER_CONFIRM" | "BLOCKING";

export type RequirementGapDecision = {
  gap: RequirementGap;
  mode: RequirementGapResolutionMode;
  reason: string;
  /** Present when {@link RequirementGapResolutionMode} is `AUTO` after resolution. */
  resolvedValue?: string;
};

export type RequirementRefinementDecision = {
  normalizedText: string;
  drafts: RequirementDraft[];
  decisions: RequirementGapDecision[];
};

export type RefinedRequirement = {
  id: string;
  projectId: string;
  description: string;
  source: "USER_INPUT" | "AUTO_RESOLVED";
  status: "DRAFT" | "REFINED";
};

export type RequirementReadinessResult = {
  isReady: boolean;
  blockingIssues: RequirementGapDecision[];
  confirmRequired: RequirementGapDecision[];
  autoResolved: RequirementGapDecision[];
};
