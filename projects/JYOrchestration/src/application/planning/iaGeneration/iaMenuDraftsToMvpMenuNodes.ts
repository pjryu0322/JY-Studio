/**
 * Strip planning-only fields so IA drafts feed existing Screen generators unchanged.
 */

import type { MvpMenuNode } from "../../../mvp/domain/mvpDomainTypes";
import type { IaMenuDraft } from "./iaGenerationContracts";

export function iaMenuDraftsToMvpMenuNodes(drafts: readonly IaMenuDraft[]): MvpMenuNode[] {
  return drafts.map(({ id, projectId, name, parentId, order }) => ({
    id,
    projectId,
    name,
    parentId,
    order,
  }));
}
