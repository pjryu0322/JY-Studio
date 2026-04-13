/**
 * Strip planning-only fields so screen drafts feed existing Task generators unchanged.
 */

import type { MvpScreen } from "../../../mvp/domain/mvpDomainTypes";
import type { ScreenDraft } from "./screenGenerationContracts";

export function screenDraftsToMvpScreens(drafts: readonly ScreenDraft[]): MvpScreen[] {
  return drafts.map(({ id, projectId, name, menuId, routePath, order }) => ({
    id,
    projectId,
    name,
    menuId,
    routePath,
    order,
  }));
}
