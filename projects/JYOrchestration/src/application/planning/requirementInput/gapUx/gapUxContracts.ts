/**
 * Requirement Gap UX — structured, UI-ready view models (no HTTP; future handoff only).
 */

import type { RequirementDraft, RequirementGap } from "../requirementInputContracts";

/** Stable UX grouping bucket (rule-derived from gap codes). */
export type RequirementGapGroupCode =
  | "AUTHENTICATION"
  | "ACCESS_SCOPE"
  | "ROLE_MODEL"
  | "SCREEN_SCOPE"
  | "CORE_FLOW";

export type RequirementGapGroup = {
  code: RequirementGapGroupCode;
  title: string;
  items: RequirementGap[];
};

export type RequirementGapPriority = "HIGH" | "MEDIUM" | "LOW";

/** One renderable section (e.g. accordion) ordered for review flows. */
export type RequirementGapSection = {
  sectionId: string;
  title: string;
  priority: RequirementGapPriority;
  questions: RequirementGap[];
};

export type RequirementGapViewModel = {
  normalizedText: string;
  drafts: RequirementDraft[];
  sections: RequirementGapSection[];
  summary: {
    totalDrafts: number;
    totalGapQuestions: number;
    highPriorityCount: number;
  };
};

export type RequirementGapViewModelInput = {
  normalizedText: string;
  drafts: readonly RequirementDraft[];
  gaps: readonly RequirementGap[];
};
