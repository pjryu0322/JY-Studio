const MY_PACKS_STORAGE_KEY = "jykstore:my-packs";

export function getStoredMyPackIds(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(MY_PACKS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function setStoredMyPackIds(packIds: string[]) {
  if (typeof window === "undefined") return;

  const uniquePackIds = Array.from(new Set(packIds));
  window.localStorage.setItem(MY_PACKS_STORAGE_KEY, JSON.stringify(uniquePackIds));
}

export function isStoredMyPack(packId: string) {
  return getStoredMyPackIds().includes(packId);
}

export function addStoredMyPack(packId: string) {
  const current = getStoredMyPackIds();
  if (current.includes(packId)) return current;

  const next = [...current, packId];
  setStoredMyPackIds(next);
  return next;
}

export function removeStoredMyPack(packId: string) {
  const next = getStoredMyPackIds().filter((id) => id !== packId);
  setStoredMyPackIds(next);
  return next;
}
