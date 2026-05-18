/**
 * Classify each detected gap into AUTO / USER_CONFIRM / BLOCKING (deterministic rules).
 */

import type { RequirementDraft, RequirementGap } from "../requirementInputContracts";
import type { RequirementGapDecision, RequirementGapResolutionMode } from "./refinementContracts";

function hasExplicitListAndDetailIntent(normalizedText: string): boolean {
  return /(목록|리스트|list)/iu.test(normalizedText) && /(상세|detail)/iu.test(normalizedText);
}

/** Very short or generic marketing-style phrases → blocking for auto downstream. */
function isGloballyBlockingText(normalizedText: string, drafts: readonly RequirementDraft[]): boolean {
  const nt = normalizedText.trim();
  if (!nt) return true;
  if (/^(좋은|nice|great)\s+(플랫폼|앱|서비스|product)/iu.test(nt) && nt.length < 40) return true;
  if (nt.length <= 14 && drafts.length > 0 && drafts.every((d) => d.confidence === "MEDIUM")) return true;
  return false;
}

function classifyOneGap(
  gap: RequirementGap,
  drafts: readonly RequirementDraft[],
  normalizedText: string
): RequirementGapDecision {
  const nt = normalizedText.trim();
  let mode: RequirementGapResolutionMode;
  let reason: string;

  switch (gap.code) {
    case "SHORT_INPUT":
      if (nt.length < 16) {
        mode = "BLOCKING";
        reason = "Input is too short to derive stable, reviewable requirements.";
      } else {
        mode = "USER_CONFIRM";
        reason = "Scope is brief; confirm intent before auto-generating features.";
      }
      break;
    case "AUTH_SCOPE":
      mode = "USER_CONFIRM";
      reason = "Authentication and access control need an explicit product choice.";
      break;
    case "VISIBILITY_OR_ROLES":
      mode = "USER_CONFIRM";
      reason = "Visibility and collaboration roles affect security and UX boundaries.";
      break;
    case "LIST_DETAIL_SCREENS":
      if (hasExplicitListAndDetailIntent(normalizedText)) {
        mode = "AUTO";
        reason = "List and detail intent is explicit; safe to assume a two-screen browse pattern.";
      } else {
        mode = "USER_CONFIRM";
        reason = "Screen split is not explicit enough to assume without confirmation.";
      }
      break;
    default:
      mode = "USER_CONFIRM";
      reason = "Unclassified gap defaults to user confirmation.";
  }

  return { gap, mode, reason };
}

/**
 * Produces one {@link RequirementGapDecision} per detected gap, plus an optional synthetic
 * blocking row when the overall idea is too vague for stable requirements.
 */
export function classifyRequirementGaps(
  gaps: readonly RequirementGap[],
  drafts: readonly RequirementDraft[],
  normalizedText: string
): RequirementGapDecision[] {
  const decisions = gaps.map((g) => classifyOneGap(g, drafts, normalizedText));
  if (isGloballyBlockingText(normalizedText, drafts)) {
    decisions.push({
      gap: {
        code: "NO_ACTIONABLE_INTENT",
        question: "Add concrete features, actors, or screens so requirements can be derived reliably.",
        severity: "IMPORTANT",
      },
      mode: "BLOCKING",
      reason: "Normalized text reads as a generic goal without actionable engineering scope.",
    });
  }
  return decisions;
}
