/**
 * Assign display priority to grouped gaps (deterministic rules).
 */

import type { RequirementDraft } from "../requirementInputContracts";
import type { RequirementGapGroup, RequirementGapPriority } from "./gapUxContracts";

export type PrioritizedGapGroup = RequirementGapGroup & { priority: RequirementGapPriority };

/**
 * Rules (explicit, no randomness):
 * - AUTHENTICATION: HIGH (auth unknown is blocking for most apps)
 * - ACCESS_SCOPE: HIGH when multiple drafts exist (cross-cutting visibility), else MEDIUM
 * - ROLE_MODEL: HIGH when 2+ drafts (coordination risk), else MEDIUM
 * - SCREEN_SCOPE: MEDIUM
 * - CORE_FLOW: LOW (short-input style hints)
 */
export function prioritizeRequirementGaps(
  groups: readonly RequirementGapGroup[],
  drafts: readonly RequirementDraft[]
): PrioritizedGapGroup[] {
  const draftCount = drafts.length;
  return groups.map((g) => {
    let priority: RequirementGapPriority;
    switch (g.code) {
      case "AUTHENTICATION":
        priority = "HIGH";
        break;
      case "ACCESS_SCOPE":
        priority = draftCount >= 2 ? "HIGH" : "MEDIUM";
        break;
      case "ROLE_MODEL":
        priority = draftCount >= 2 ? "HIGH" : "MEDIUM";
        break;
      case "SCREEN_SCOPE":
        priority = "MEDIUM";
        break;
      case "CORE_FLOW":
      default:
        priority = "LOW";
        break;
    }
    return { ...g, priority };
  });
}
