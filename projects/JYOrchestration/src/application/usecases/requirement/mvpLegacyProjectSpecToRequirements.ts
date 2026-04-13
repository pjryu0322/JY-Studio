/**
 * LEGACY (input bridge) — treat a ProjectSpec-style body as **one** coarse Requirement.
 *
 * Keeps older “big spec blob” inputs working without making ProjectSpec a first-class dependency
 * of the MVP domain pipeline. Remove when retirement checklist is satisfied and no callers remain.
 *
 * @see docs/MVP_LEGACY_RETIREMENT_CHECKLIST.md
 */

import type { MvpRequirement } from "../../../mvp/domain/mvpDomainTypes";
import { normalizeRequirementText } from "./mvpNormalizeRequirementText";

function stripLeadingMarkdownTitle(text: string): string {
  return text.replace(/^\s{0,3}#{1,6}\s+[^\n]*\n+/u, "").trim();
}

/**
 * @param specBodyText Freeform markdown or plain text from a legacy ProjectSpec document.
 */
export function requirementsFromLegacyProjectSpecBody(projectId: string, specBodyText: string): MvpRequirement[] {
  const stripped = stripLeadingMarkdownTitle(String(specBodyText ?? ""));
  const normalized = normalizeRequirementText(stripped);
  const description =
    normalized.length > 0 ? normalized.slice(0, 4000) : "(legacy ProjectSpec body empty after normalize)";
  return [
    {
      id: `req-${projectId}-legacy-spec-0`,
      projectId,
      description,
      status: "CONFIRMED",
    },
  ];
}
