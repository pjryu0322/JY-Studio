/**
 * Attach deterministic `resolvedValue` only for AUTO-classified gaps (low-risk assumptions).
 */

import type { RequirementDraft } from "../requirementInputContracts";
import type { RequirementGapDecision } from "./refinementContracts";

export function autoResolveRequirementGaps(
  decisions: readonly RequirementGapDecision[],
  _drafts: readonly RequirementDraft[]
): RequirementGapDecision[] {
  return decisions.map((d) => {
    if (d.mode !== "AUTO") {
      return { ...d };
    }
    if (d.gap.code === "LIST_DETAIL_SCREENS") {
      return {
        ...d,
        resolvedValue:
          "Assumed UX: one list/browse screen and one detail screen for the same content type, with navigation between them.",
      };
    }
    return { ...d };
  });
}
