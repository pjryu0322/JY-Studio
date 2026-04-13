/**
 * Turn drafts + refinement decisions into structured {@link RefinedRequirement} rows.
 *
 * AUTO resolutions append a short, traceable assumption block to descriptions.
 */

import type { RequirementRefinementDecision } from "./refinementContracts";
import type { RefinedRequirement } from "./refinementContracts";

export type BuildRefinedRequirementsInput = {
  refinementDecision: RequirementRefinementDecision;
};

export function buildRefinedRequirements(input: BuildRefinedRequirementsInput): RefinedRequirement[] {
  const { refinementDecision } = input;
  const autoNotes = refinementDecision.decisions
    .filter((d) => d.mode === "AUTO" && d.resolvedValue)
    .map((d) => `[${d.gap.code}] ${d.resolvedValue}`);
  const enrich = autoNotes.length > 0 ? `\n${autoNotes.join("\n")}` : "";

  return refinementDecision.drafts.map((draft, i) => ({
    id: `ref-${draft.projectId}-${i}`,
    projectId: draft.projectId,
    description: enrich ? `${draft.description}${enrich}`.trim() : draft.description,
    source: enrich ? "AUTO_RESOLVED" : "USER_INPUT",
    status: enrich ? "REFINED" : "DRAFT",
  }));
}
