import type { KnowledgeScopeItemDecision } from "@prisma/client";
import {
  assessWorkerCapability,
  isKnowledgeEligibleForInclude,
} from "@/lib/python-worker/worker-capability-policy";
import { KnowledgeScopeInventoryError } from "@/lib/knowledge-scope/inventory-types";

export type WorkerInputManifestPaths = {
  includedPaths: string[];
  excludePaths: string[];
};

export type InventoryManifestItem = {
  id?: string;
  relativePath: string;
  decision: KnowledgeScopeItemDecision;
  fileName?: string;
  extension?: string;
  fileCategory?: string | null;
};

export type WorkerInputManifestEntry = {
  inventoryItemId: string;
  relativePath: string;
};

export function listIncludedRelativePaths(items: InventoryManifestItem[]): string[] {
  return items.filter((i) => i.decision === "INCLUDED").map((i) => i.relativePath);
}

export function buildWorkerInputManifestFromItems(
  items: InventoryManifestItem[],
): WorkerInputManifestPaths & { includedEntries: WorkerInputManifestEntry[] } {
  const includedPaths: string[] = [];
  const excludePaths: string[] = [];
  const includedEntries: WorkerInputManifestEntry[] = [];
  for (const item of items) {
    if (item.decision === "INCLUDED") {
      includedPaths.push(item.relativePath);
      if (item.id) {
        includedEntries.push({
          inventoryItemId: item.id,
          relativePath: item.relativePath,
        });
      }
    } else {
      excludePaths.push(item.relativePath);
    }
  }
  includedPaths.sort((a, b) => a.localeCompare(b, "ko"));
  excludePaths.sort((a, b) => a.localeCompare(b, "ko"));
  includedEntries.sort((a, b) => a.relativePath.localeCompare(b.relativePath, "ko"));
  return { includedPaths, excludePaths, includedEntries };
}

/** Ensure every INCLUDED item is Worker knowledge-eligible (SUPPORTED). */
export function assertIncludedItemsMatchWorkerCapability(
  items: InventoryManifestItem[],
): void {
  for (const item of items) {
    if (item.decision !== "INCLUDED") continue;
    const fileName =
      item.fileName ||
      item.relativePath.replace(/\\/g, "/").split("/").filter(Boolean).pop() ||
      item.relativePath;
    const extension =
      item.extension ||
      (() => {
        const base = fileName;
        const dot = base.lastIndexOf(".");
        return dot > 0 ? base.slice(dot).toLowerCase() : "";
      })();
    const assessment = assessWorkerCapability({
      relativePath: item.relativePath,
      fileName,
      extension,
    });
    if (!isKnowledgeEligibleForInclude(assessment)) {
      throw new KnowledgeScopeInventoryError(
        "WORKER_CAPABILITY_MISMATCH",
        `INCLUDED 파일이 Worker 지식화 대상이 아닙니다: ${item.relativePath}`,
        409,
      );
    }
  }
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

export function buildInventoryItemIdByPath(
  entries: WorkerInputManifestEntry[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const e of entries) {
    map[e.relativePath.replace(/\\/g, "/")] = e.inventoryItemId;
  }
  return map;
}
