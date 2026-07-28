import type { KnowledgeScopeItemDecision } from "@prisma/client";

export type WorkerInputManifestPaths = {
  includedPaths: string[];
  excludePaths: string[];
};

export type InventoryManifestItem = {
  relativePath: string;
  decision: KnowledgeScopeItemDecision;
};

export function listIncludedRelativePaths(items: InventoryManifestItem[]): string[] {
  return items.filter((i) => i.decision === "INCLUDED").map((i) => i.relativePath);
}

export function buildWorkerInputManifestFromItems(
  items: InventoryManifestItem[],
): WorkerInputManifestPaths {
  const includedPaths: string[] = [];
  const excludePaths: string[] = [];
  for (const item of items) {
    if (item.decision === "INCLUDED") {
      includedPaths.push(item.relativePath);
    } else {
      excludePaths.push(item.relativePath);
    }
  }
  includedPaths.sort((a, b) => a.localeCompare(b, "ko"));
  excludePaths.sort((a, b) => a.localeCompare(b, "ko"));
  return { includedPaths, excludePaths };
}

export function mergeAdminExcludePaths(
  preflightPaths: string[],
  inventoryExcludePaths: string[],
): string[] {
  const set = new Set<string>();
  for (const p of preflightPaths) {
    const normalized = p.replace(/\\/g, "/").replace(/\/+$/, "");
    if (normalized) set.add(normalized);
  }
  for (const p of inventoryExcludePaths) {
    const normalized = p.replace(/\\/g, "/").replace(/\/+$/, "");
    if (normalized) set.add(normalized);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "ko"));
}
