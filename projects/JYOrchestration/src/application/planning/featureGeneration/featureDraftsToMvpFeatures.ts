/**
 * Strip planning-only fields so {@link FeatureDraft} rows feed existing IA generators.
 */

import type { MvpFeature } from "../../../mvp/domain/mvpDomainTypes";
import type { FeatureDraft } from "./featureGenerationContracts";

export function featureDraftsToMvpFeatures(drafts: readonly FeatureDraft[]): MvpFeature[] {
  return drafts.map(({ id, projectId, name, requirementIds, order }) => ({
    id,
    projectId,
    name,
    requirementIds,
    order,
  }));
}
