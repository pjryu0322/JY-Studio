/**
 * Feature-generation entry gate — structured handoff before domain Feature synthesis.
 */

import type { RequirementGapDecision, RefinedRequirement } from "../requirementInput/refinement/refinementContracts";

export type FeatureGenerationEntryStatus = "READY" | "NEEDS_CONFIRMATION" | "BLOCKED";

export type FeatureGenerationBlockedReason = {
  code: string;
  message: string;
  /** When this reason traces to a refinement gap row. */
  sourceGapCode?: string;
};

export type FeatureGenerationDecision = {
  status: FeatureGenerationEntryStatus;
  reasons: FeatureGenerationBlockedReason[];
};

export type FeatureGenerationInputBundle = {
  projectId: string;
  refinedRequirements: RefinedRequirement[];
};

export type FeatureGenerationEntryResult =
  | {
      ok: true;
      status: "READY";
      input: FeatureGenerationInputBundle;
    }
  | {
      ok: false;
      status: "NEEDS_CONFIRMATION" | "BLOCKED";
      reasons: FeatureGenerationBlockedReason[];
      pendingGapDecisions: RequirementGapDecision[];
    };
