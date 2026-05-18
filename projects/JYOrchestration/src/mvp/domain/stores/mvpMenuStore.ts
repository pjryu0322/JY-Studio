/**
 * MVP — in-memory MenuNode (IA) store for prompt context lookup.
 */

import type { MvpMenuNode } from "../mvpDomainTypes";

const byProject = new Map<string, MvpMenuNode[]>();
const byId = new Map<string, MvpMenuNode>();

export function mvpSeedProjectMenuNodes(projectId: string, nodes: MvpMenuNode[]): void {
  // reset previous project nodes from byId
  const prev = byProject.get(projectId) ?? [];
  for (const n of prev) {
    byId.delete(n.id);
  }
  const next = nodes.map((n) => ({ ...n, projectId }));
  byProject.set(projectId, next);
  for (const n of next) {
    byId.set(n.id, n);
  }
}

export function mvpGetMenuNodeById(menuId: string): MvpMenuNode | undefined {
  const n = byId.get(menuId);
  return n ? { ...n } : undefined;
}

export function mvpListProjectMenuNodes(projectId: string): readonly MvpMenuNode[] {
  return [...(byProject.get(projectId) ?? [])].map((n) => ({ ...n }));
}

export function mvpClearMenuStore(): void {
  byProject.clear();
  byId.clear();
}

