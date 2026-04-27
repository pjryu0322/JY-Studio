/** 동일 탭에서 `useGlobalPreferences` 등과 동기화 */
export const GLOBAL_PREFERENCES_CHANGED_EVENT = "jyo:global-preferences-changed";

const KEYS = {
  aiFacilitatorAutoJoin: "jyo:pref:ai-facilitator-auto-join",
  devPanelVisible: "jyo:pref:dev-panel-visible",
} as const;

function dispatchChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GLOBAL_PREFERENCES_CHANGED_EVENT));
}

function readBool(key: string, defaultValue: boolean): boolean {
  if (typeof window === "undefined") return defaultValue;
  try {
    const v = window.localStorage.getItem(key);
    if (v === "true") return true;
    if (v === "false") return false;
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

function writeBool(key: string, value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value ? "true" : "false");
    dispatchChanged();
  } catch {
    /* ignore */
  }
}

export function readAiFacilitatorAutoJoin(): boolean {
  return readBool(KEYS.aiFacilitatorAutoJoin, true);
}

export function writeAiFacilitatorAutoJoin(value: boolean): void {
  writeBool(KEYS.aiFacilitatorAutoJoin, value);
}

export function readDevPanelVisible(): boolean {
  return readBool(KEYS.devPanelVisible, false);
}

export function writeDevPanelVisible(value: boolean): void {
  writeBool(KEYS.devPanelVisible, value);
}

export type GlobalPreferencesSnapshot = {
  aiFacilitatorAutoJoin: boolean;
  devPanelVisible: boolean;
};

export function readGlobalPreferencesSnapshot(): GlobalPreferencesSnapshot {
  return {
    aiFacilitatorAutoJoin: readAiFacilitatorAutoJoin(),
    devPanelVisible: readDevPanelVisible(),
  };
}

const STORAGE_KEYS = new Set<string>(Object.values(KEYS));

export function subscribeGlobalPreferences(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const on = () => listener();
  window.addEventListener(GLOBAL_PREFERENCES_CHANGED_EVENT, on);
  const onStorage = (e: StorageEvent) => {
    if (e.key && !STORAGE_KEYS.has(e.key)) return;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(GLOBAL_PREFERENCES_CHANGED_EVENT, on);
    window.removeEventListener("storage", onStorage);
  };
}
