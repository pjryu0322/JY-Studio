"use client";

import { resolveExplainabilityForCandidateRow } from "@/lib/project-structure/projectStructureExplainabilityService";
import type { StructureCandidateRow } from "@/lib/project-structure/structureReviewUiTypes";
import { StructureExplainabilityPanel } from "@/components/project-structure/StructureExplainabilityPanel";

export { StructureConfidenceBadge } from "@/components/project-structure/StructureExplainabilityPanel";

/** @deprecated Use StructureExplainabilityPanel */
export function StructureExplainabilitySection({
  candidate,
}: {
  readonly candidate: StructureCandidateRow;
}) {
  const explainability = resolveExplainabilityForCandidateRow(candidate);
  return <StructureExplainabilityPanel explainability={explainability} />;
}
