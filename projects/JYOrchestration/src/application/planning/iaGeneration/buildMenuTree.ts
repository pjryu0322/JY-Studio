/**
 * Validate parent links and return a deterministic visit order for menu drafts.
 */

import type { IaMenuDraft } from "./iaGenerationContracts";

function depth(id: string, byId: ReadonlyMap<string, IaMenuDraft>): number {
  let d = 0;
  let cur: IaMenuDraft | undefined = byId.get(id);
  const guard = new Set<string>();
  while (cur && cur.parentId != null) {
    if (guard.has(cur.id)) break;
    guard.add(cur.id);
    d++;
    cur = byId.get(cur.parentId);
    if (d > 64) break;
  }
  return d;
}

/**
 * Drops nodes whose `parentId` is missing (except `null`), then sorts by depth, order, id.
 */
export function buildMenuTree(menuNodes: readonly IaMenuDraft[]): IaMenuDraft[] {
  const byId = new Map(menuNodes.map((m) => [m.id, m]));
  const idSet = new Set(byId.keys());
  const valid = menuNodes.filter((m) => m.parentId == null || idSet.has(m.parentId));
  return [...valid].sort((a, b) => {
    const da = depth(a.id, byId);
    const db = depth(b.id, byId);
    if (da !== db) return da - db;
    if (a.order !== b.order) return a.order - b.order;
    return a.id.localeCompare(b.id);
  });
}
