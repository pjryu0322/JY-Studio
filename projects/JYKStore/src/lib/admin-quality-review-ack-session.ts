/**
 * Browser-session ack that the admin finished reviewing quality results.
 *
 * Completing unlocks the correction (or provider) workbench step in the UI.
 * Cancelling re-enables 「실행」 so the admin can re-run quality checks.
 * No DB schema — pack-scoped map + sessionStorage survive remounts in the tab.
 */

const STORAGE_PREFIX = "jykstore.adminQualityReviewAck.";

const memoryAcks = new Map<string, boolean>();

function storageKey(packId: string): string {
  return `${STORAGE_PREFIX}${packId.trim()}`;
}

function readStorage(packId: string): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(storageKey(packId)) === "1";
  } catch {
    return false;
  }
}

function writeStorage(packId: string, acknowledged: boolean): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const key = storageKey(packId);
    if (acknowledged) sessionStorage.setItem(key, "1");
    else sessionStorage.removeItem(key);
  } catch {
    // ignore quota / private mode
  }
}

export function isAdminQualityReviewAcknowledged(packId: string): boolean {
  const key = packId.trim();
  if (!key) return false;
  if (memoryAcks.has(key)) return Boolean(memoryAcks.get(key));
  const stored = readStorage(key);
  memoryAcks.set(key, stored);
  return stored;
}

export function setAdminQualityReviewAcknowledged(
  packId: string,
  acknowledged: boolean,
): void {
  const key = packId.trim();
  if (!key) return;
  memoryAcks.set(key, acknowledged);
  writeStorage(key, acknowledged);
}

export function clearAdminQualityReviewAcknowledged(packId: string): void {
  setAdminQualityReviewAcknowledged(packId, false);
}
