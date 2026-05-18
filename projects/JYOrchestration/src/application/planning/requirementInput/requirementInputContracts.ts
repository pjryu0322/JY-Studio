/**
 * Requirement Input — internal contracts (planning layer only; no HTTP/DB).
 *
 * User idea sentence → normalized input → drafts + gaps → `MvpRequirement` entities.
 */

import type { MvpRequirement } from "../../../mvp/domain/mvpDomainTypes";

export type RequirementInputRequest = {
  projectId: string;
  inputText: string;
};

/** Normalized, single-line intent text ready for splitting / gap detection. */
export type RequirementInputNormalized = {
  text: string;
};

export type RequirementDraft = {
  id: string;
  projectId: string;
  description: string;
  source: "USER_INPUT";
  confidence: "HIGH" | "MEDIUM";
};

export type RequirementGap = {
  code: string;
  question: string;
  severity: "INFO" | "IMPORTANT";
};

export type RequirementDraftResult = {
  normalizedText: string;
  drafts: RequirementDraft[];
  gaps: RequirementGap[];
};

export type PrepareRequirementsFromInputResult = {
  draftResult: RequirementDraftResult;
  /** Rows compatible with `mvpSeedProjectRequirements` + domain generation. */
  requirements: MvpRequirement[];
};
