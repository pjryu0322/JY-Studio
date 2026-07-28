/**
 * P3.1 — fingerprint of the Working Copy file set used to build Inventory.
 * Canonical form: sorted lines of `relativePath\0sizeBytes\0contentHashOrEmpty`
 * then SHA-256 hex.
 */
import { sha256Hex } from "@/lib/object-storage/checksum";

export type InventoryFingerprintEntry = {
  relativePath: string;
  sizeBytes: number;
  contentHash?: string | null;
};

export const INVENTORY_SOURCE_FINGERPRINT_VERSION = "inventory-source-fp-v1";

export function normalizeInventoryFingerprintPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

export function buildInventorySourceFingerprint(
  entries: readonly InventoryFingerprintEntry[],
): string {
  const lines = entries
    .map((e) => {
      const path = normalizeInventoryFingerprintPath(e.relativePath);
      const size = Number.isFinite(e.sizeBytes) ? Math.max(0, Math.trunc(e.sizeBytes)) : 0;
      const hash = (e.contentHash ?? "").trim().toLowerCase();
      return `${path}\0${size}\0${hash}`;
    })
    .sort((a, b) => a.localeCompare(b));
  const payload = `${INVENTORY_SOURCE_FINGERPRINT_VERSION}\n${lines.join("\n")}`;
  return sha256Hex(new TextEncoder().encode(payload));
}

export function fingerprintsMatch(
  expected: string | null | undefined,
  actual: string | null | undefined,
): boolean {
  if (!expected || !actual) return false;
  return expected.trim().toLowerCase() === actual.trim().toLowerCase();
}
