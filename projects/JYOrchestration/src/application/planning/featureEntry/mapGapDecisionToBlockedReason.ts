/**
 * Map refinement gap decisions to entry-layer reason rows (deterministic).
 */

import type { RequirementGapDecision } from "../requirementInput/refinement/refinementContracts";
import type { FeatureGenerationBlockedReason } from "./featureEntryContracts";
import { FEATURE_GENERATION_ENTRY_CODE } from "./featureEntryResultCodes";

export function mapGapDecisionToBlockedReason(decision: RequirementGapDecision): FeatureGenerationBlockedReason {
  const code = decision.gap.code;
  let reasonCode: string;
  if (decision.mode === "BLOCKING") {
    if (code === "NO_ACTIONABLE_INTENT") {
      reasonCode = FEATURE_GENERATION_ENTRY_CODE.BLOCKED_VAGUE_INPUT;
    } else {
      reasonCode = FEATURE_GENERATION_ENTRY_CODE.BLOCKED;
    }
  } else {
    if (code === "AUTH_SCOPE") {
      reasonCode = FEATURE_GENERATION_ENTRY_CODE.NEEDS_CONFIRMATION_AUTH;
    } else if (code === "VISIBILITY_OR_ROLES") {
      reasonCode = FEATURE_GENERATION_ENTRY_CODE.NEEDS_CONFIRMATION_ACCESS_SCOPE;
    } else {
      reasonCode = FEATURE_GENERATION_ENTRY_CODE.NEEDS_CONFIRMATION_GENERIC;
    }
  }
  return {
    code: reasonCode,
    message: decision.reason,
    sourceGapCode: code,
  };
}
