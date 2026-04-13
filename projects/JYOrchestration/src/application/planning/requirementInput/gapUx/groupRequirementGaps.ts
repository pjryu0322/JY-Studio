/**
 * Deterministic grouping of raw {@link RequirementGap} rows into UX buckets.
 */

import type { RequirementGap } from "../requirementInputContracts";
import type { RequirementGapGroup, RequirementGapGroupCode } from "./gapUxContracts";

const GROUP_TITLES: Record<RequirementGapGroupCode, string> = {
  AUTHENTICATION: "Authentication & sign-in",
  ACCESS_SCOPE: "Access, visibility & sharing",
  ROLE_MODEL: "Roles, hosts & participants",
  SCREEN_SCOPE: "Screens, lists & details",
  CORE_FLOW: "Product scope & main flow",
};

function gapCodeToGroupCode(code: string): RequirementGapGroupCode {
  switch (code) {
    case "AUTH_SCOPE":
      return "AUTHENTICATION";
    case "VISIBILITY_OR_ROLES":
      return "ROLE_MODEL";
    case "LIST_DETAIL_SCREENS":
      return "SCREEN_SCOPE";
    case "SHORT_INPUT":
      return "CORE_FLOW";
    default:
      return "CORE_FLOW";
  }
}

const GROUP_ORDER: readonly RequirementGapGroupCode[] = [
  "AUTHENTICATION",
  "ACCESS_SCOPE",
  "ROLE_MODEL",
  "SCREEN_SCOPE",
  "CORE_FLOW",
];

/**
 * Merges gaps that map to the same UX group; order within a group follows input order.
 */
export function groupRequirementGaps(gaps: readonly RequirementGap[]): RequirementGapGroup[] {
  const byGroup = new Map<RequirementGapGroupCode, RequirementGap[]>();
  for (const g of gaps) {
    const gc = gapCodeToGroupCode(g.code);
    const list = byGroup.get(gc) ?? [];
    list.push(g);
    byGroup.set(gc, list);
  }
  const out: RequirementGapGroup[] = [];
  for (const code of GROUP_ORDER) {
    const items = byGroup.get(code);
    if (items && items.length > 0) {
      out.push({ code, title: GROUP_TITLES[code], items: [...items] });
    }
  }
  return out;
}
