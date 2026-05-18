/**
 * Map {@link RefinedRequirement} rows to `MvpRequirement` for the existing domain pipeline.
 *
 * Downstream generators expect `status: "CONFIRMED"` for the mockup path used in self-check.
 */

import type { MvpRequirement } from "../../../../mvp/domain/mvpDomainTypes";
import type { RefinedRequirement } from "./refinementContracts";

export function refinedRequirementsToMvpRequirements(rows: readonly RefinedRequirement[]): MvpRequirement[] {
  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    description: r.description,
    status: "CONFIRMED",
  }));
}
