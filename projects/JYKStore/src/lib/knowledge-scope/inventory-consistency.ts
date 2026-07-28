import {
  buildInventorySourceFingerprint,
  fingerprintsMatch,
  type InventoryFingerprintEntry,
} from "@/lib/knowledge-scope/inventory-source-fingerprint";
import { KnowledgeScopeInventoryError } from "@/lib/knowledge-scope/inventory-types";
import { buildZipPreflightInventory } from "@/lib/python-worker/zip-preflight-inventory";

export type InventoryConsistencySummary = {
  id: string;
  status: string;
  workingCopyId: string | null;
  sourceRevisionId: string;
  inventorySourceFingerprint: string | null;
};

/**
 * Assert Inventory is bound to a Working Copy and its fingerprint still matches
 * the current Working Copy file set. Throws KnowledgeScopeInventoryError codes:
 * WORKING_COPY_REQUIRED | INVENTORY_STALE | WORKING_COPY_CHANGED | SCOPE_REBUILD_REQUIRED
 */
export async function assertInventoryMatchesWorkingCopyBytes(input: {
  inventory: InventoryConsistencySummary;
  workingCopyId: string;
  workingCopySourceRevisionId: string;
  zipBytes: Uint8Array;
}): Promise<{ fingerprint: string; entries: InventoryFingerprintEntry[] }> {
  if (!input.inventory.workingCopyId?.trim()) {
    throw new KnowledgeScopeInventoryError(
      "WORKING_COPY_REQUIRED",
      "Inventory에 Working Copy가 연결되어 있지 않습니다.",
      409,
    );
  }
  if (input.inventory.workingCopyId !== input.workingCopyId) {
    throw new KnowledgeScopeInventoryError(
      "WORKING_COPY_CHANGED",
      "Inventory가 가리키는 Working Copy와 현재 실행 Working Copy가 다릅니다.",
      409,
    );
  }
  if (input.inventory.sourceRevisionId !== input.workingCopySourceRevisionId) {
    throw new KnowledgeScopeInventoryError(
      "WORKING_COPY_CHANGED",
      "Inventory와 Working Copy의 원본 revision이 일치하지 않습니다.",
      409,
    );
  }
  if (!input.inventory.inventorySourceFingerprint?.trim()) {
    throw new KnowledgeScopeInventoryError(
      "SCOPE_REBUILD_REQUIRED",
      "Inventory fingerprint가 없습니다. Working Copy 기준으로 범위를 다시 생성하세요.",
      409,
    );
  }
  if (input.inventory.status !== "FINALIZED") {
    throw new KnowledgeScopeInventoryError(
      "KNOWLEDGE_SCOPE_NOT_READY",
      "지식화 대상 범위가 확정되지 않았습니다.",
      409,
    );
  }

  const scan = await buildZipPreflightInventory(input.zipBytes);
  const entries = scan.entries
    .filter((e) => e.kind === "file")
    .map((e) => ({
      relativePath: e.path,
      sizeBytes: e.sizeBytes ?? 0,
      contentHash: null as string | null,
    }));
  const fingerprint = buildInventorySourceFingerprint(entries);

  if (!fingerprintsMatch(input.inventory.inventorySourceFingerprint, fingerprint)) {
    throw new KnowledgeScopeInventoryError(
      "INVENTORY_STALE",
      "Working Copy 파일 집합이 Inventory 생성 시점과 다릅니다. 지식화 대상을 다시 확정하세요.",
      409,
    );
  }

  return { fingerprint, entries };
}
