/**
 * Deterministic {@link ScreenDraft} rows from IA / menu nodes (excludes synthetic root menus).
 *
 * Preconditions: non-empty content menus (non-root) and a valid menu graph — use {@link buildScreenGenerationResult}.
 */

import type { ScreenDraft, ScreenGenerationResult, ScreenTrace } from "./screenGenerationContracts";
import { buildScreenRoutePath, dedupeRoutePaths, type BuildScreenRoutePathContext, type ScreenRouteMenuNode } from "./buildScreenRoutePath";
import { inferScreenRoleFromMenuName } from "./inferScreenRole";
import { normalizeScreenName } from "./normalizeScreenName";

export type ScreenMenuInput = {
  id: string;
  projectId: string;
  name: string;
  parentId: string | null;
  order: number;
  sourceFeatureIds?: readonly string[];
};

/**
 * One screen per non-root menu node, stable order, routes and roles filled in a second pass.
 */
export function generateScreensFromIa(menuNodes: readonly ScreenMenuInput[]): ScreenGenerationResult {
  const projectId = menuNodes[0]!.projectId;
  const rootMenuIds = new Set(menuNodes.filter((m) => m.parentId == null).map((m) => m.id));
  const contentMenus = [...menuNodes]
    .filter((m) => !rootMenuIds.has(m.id))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  const menuById: Map<string, ScreenRouteMenuNode> = new Map(
    menuNodes.map((m) => [m.id, { id: m.id, name: m.name, parentId: m.parentId }])
  );
  const routeCtx: BuildScreenRoutePathContext = { menuById, rootMenuIds };

  const drafts: ScreenDraft[] = contentMenus.map((m, idx) => {
    const parent = m.parentId ? menuNodes.find((x) => x.id === m.parentId) : undefined;
    const displayName = normalizeScreenName(m.name, parent ? { parentMenuName: parent.name } : undefined);
    const parentScreenId =
      m.parentId != null && !rootMenuIds.has(m.parentId) ? `screen-${m.parentId}` : undefined;
    const screenRole = inferScreenRoleFromMenuName(displayName);
    return {
      id: `screen-${m.id}`,
      projectId: m.projectId,
      name: displayName,
      menuId: m.id,
      routePath: "",
      order: idx,
      parentScreenId,
      screenRole,
    };
  });

  const withPaths = drafts.map((s) => ({
    ...s,
    routePath: buildScreenRoutePath(s, routeCtx),
  }));
  const screens = dedupeRoutePaths(withPaths).map((s, i) => ({ ...s, order: i }));

  const traces: ScreenTrace[] = screens.map((s) => {
    const src = menuNodes.find((m) => m.id === s.menuId);
    const ids = src && Array.isArray(src.sourceFeatureIds) ? [...src.sourceFeatureIds] : undefined;
    return {
      screenId: s.id,
      menuId: s.menuId,
      ...(ids && ids.length > 0 ? { sourceFeatureIds: ids } : {}),
    };
  });

  return { projectId, screens, traces };
}
